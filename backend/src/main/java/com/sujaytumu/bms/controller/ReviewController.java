package com.sujaytumu.bms.controller;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Movie ratings (1-10) and short text reviews. One review per user per movie;
 * saving again edits it. Reading is public (/api/movies/** is already permitAll);
 * writing lives under /api/reviews, which requires login like every other
 * non-public route, so SecurityConfig needs no change.
 */
@RestController
public class ReviewController {

    private static final int MAX_BODY_LENGTH = 500;

    private final JdbcTemplate db;

    public ReviewController(JdbcTemplate db) {
        this.db = db;
    }

    /** Public: average, count, 1-10 histogram and the latest reviews for a movie. */
    @GetMapping("/api/movies/{movieId}/reviews")
    public Map<String, Object> list(@PathVariable long movieId) {
        Map<String, Object> summary = db.queryForMap(
                "select count(*) as review_count, coalesce(round(avg(rating)::numeric,1),0) as average " +
                        "from reviews where movie_id=?", movieId);

        // distribution.get(0) = number of 1-star ratings ... distribution.get(9) = number of 10s
        List<Integer> distribution = new ArrayList<>(Collections.nCopies(10, 0));
        for (Map<String, Object> row : db.queryForList(
                "select rating, count(*) as c from reviews where movie_id=? group by rating", movieId)) {
            int rating = ((Number) row.get("rating")).intValue();
            if (rating >= 1 && rating <= 10) {
                distribution.set(rating - 1, ((Number) row.get("c")).intValue());
            }
        }

        // Only the first name is public. "verified" = this reviewer has a confirmed booking
        // for this movie whose show has already started.
        List<Map<String, Object>> reviews = db.queryForList(
                "select r.id, split_part(trim(u.name),' ',1) as user_name, r.rating, r.body, r.created_at, " +
                        "exists(select 1 from bookings b join shows sh on sh.id=b.show_id " +
                        "  where b.user_id=r.user_id and sh.movie_id=r.movie_id and b.status='CONFIRMED' " +
                        "  and (sh.show_date + sh.start_time) <= (now() at time zone 'Asia/Kolkata')) as verified " +
                        "from reviews r join users u on u.id=r.user_id " +
                        "where r.movie_id=? order by r.created_at desc limit 50", movieId);

        return Map.of(
                "average", summary.get("average"),
                "count", ((Number) summary.get("review_count")).intValue(),
                "distribution", distribution,
                "reviews", reviews);
    }

    /** Logged-in user's own review of a movie, or an empty object if they haven't reviewed it. */
    @GetMapping("/api/reviews/mine")
    public Map<String, Object> mine(Authentication auth, @RequestParam long movieId) {
        List<Map<String, Object>> rows = db.queryForList(
                "select rating, body, updated_at from reviews " +
                        "where movie_id=? and user_id=(select id from users where email=?)",
                movieId, auth.getName());
        return rows.isEmpty() ? Collections.<String, Object>emptyMap() : rows.get(0);
    }

    /** Create or update the logged-in user's review. Body: {movieId, rating (1-10), body (optional)}. */
    @PutMapping("/api/reviews")
    public Map<String, String> save(Authentication auth, @RequestBody Map<String, Object> request) {
        long movieId = requireNumber(request.get("movieId"), "movieId");
        int rating = (int) requireNumber(request.get("rating"), "rating");
        if (rating < 1 || rating > 10) {
            throw bad("Rating must be between 1 and 10");
        }

        String text = request.get("body") == null ? null : request.get("body").toString().trim();
        if (text != null && text.isEmpty()) {
            text = null;
        }
        if (text != null && text.length() > MAX_BODY_LENGTH) {
            throw bad("Review can be at most " + MAX_BODY_LENGTH + " characters");
        }

        List<Map<String, Object>> movie = db.queryForList(
                "select upcoming from movies where id=? and active=true", movieId);
        if (movie.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Movie not found");
        }
        if (Boolean.TRUE.equals(movie.get(0).get("upcoming"))) {
            throw bad("You can rate a movie once it has been released");
        }

        Long userId = db.queryForObject("select id from users where email=?", Long.class, auth.getName());
        db.update(
                "insert into reviews(movie_id,user_id,rating,body) values(?,?,?,?) " +
                        "on conflict (movie_id,user_id) do update " +
                        "set rating=excluded.rating, body=excluded.body, updated_at=now()",
                movieId, userId, rating, text);
        return Map.of("message", "Thanks for your review!");
    }

    /** Remove the logged-in user's review of a movie (no-op if there isn't one). */
    @DeleteMapping("/api/reviews")
    public Map<String, String> remove(Authentication auth, @RequestParam long movieId) {
        db.update("delete from reviews where movie_id=? and user_id=(select id from users where email=?)",
                movieId, auth.getName());
        return Map.of("message", "Review removed");
    }

    private static long requireNumber(Object value, String field) {
        if (value instanceof Number n) {
            return n.longValue();
        }
        throw bad(field + " is required and must be a number");
    }

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
