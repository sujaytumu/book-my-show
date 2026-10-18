package com.sujaytumu.bms.service;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/** Per-account movie watchlist plus automatic release reminders ("releases tomorrow", "now showing"). */
@Service
public class WatchlistService {

    private final JdbcTemplate db;
    private final EmailService emailService;

    public WatchlistService(JdbcTemplate db, EmailService emailService) {
        this.db = db;
        this.emailService = emailService;
    }

    public List<Map<String, Object>> list(String email) {
        return db.queryForList(
                "select m.id, m.title, m.poster_url, m.language, m.release_date, m.upcoming from watchlist_movies w " +
                        "join movies m on m.id=w.movie_id join users u on u.id=w.user_id where u.email=? order by w.created_at desc", email);
    }

    public void add(String email, long movieId) {
        Long exists = db.queryForObject("select count(*) from movies where id=?", Long.class, movieId);
        if (exists == null || exists == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Movie not found");
        db.update("insert into watchlist_movies(user_id,movie_id) select id, ? from users where email=? on conflict do nothing",
                movieId, email);
    }

    public void remove(String email, long movieId) {
        db.update("delete from watchlist_movies w using users u where u.id=w.user_id and u.email=? and w.movie_id=?", email, movieId);
    }

    @Scheduled(initialDelay = 60000, fixedDelay = 3600000)
    public void sendReminders() {
        try {
            remind("tomorrow");
            remind("release");
        } catch (Exception e) {
            System.err.println("[reminders] failed: " + e.getMessage());
        }
    }

    private void remind(String kind) {
        boolean tomorrow = kind.equals("tomorrow");
        String flag = tomorrow ? "reminded_tomorrow" : "reminded_release";
        String when = tomorrow
                ? "m.release_date = (now() at time zone 'Asia/Kolkata')::date + 1"
                : "m.upcoming = false and m.release_date is not null and m.release_date <= (now() at time zone 'Asia/Kolkata')::date";
        List<Map<String, Object>> due = db.queryForList(
                "select w.user_id, w.movie_id, u.email, m.title from watchlist_movies w join users u on u.id=w.user_id " +
                        "join movies m on m.id=w.movie_id where w." + flag + "=false and " + when + " and m.active=true");
        for (Map<String, Object> d : due) {
            db.update("update watchlist_movies set " + flag + "=true where user_id=? and movie_id=?", d.get("user_id"), d.get("movie_id"));
            String title = tomorrow ? d.get("title") + " releases tomorrow" : d.get("title") + " is now showing";
            String body = tomorrow
                    ? "Get ready - " + d.get("title") + " from your watchlist hits cinemas tomorrow. Bookings open as shows are added."
                    : d.get("title") + " from your watchlist is now playing. Book your seats before they fill up.";
            db.update("insert into user_notifications(user_id,kind,title,body,link) values(?,?,?,?,?)",
                    d.get("user_id"), "release", title, body, "/movie/" + d.get("movie_id"));
            final String to = String.valueOf(d.get("email"));
            final String html = "<p>" + body + "</p><p>Open the Book My Show app to see showtimes.</p>";
            CompletableFuture.runAsync(() -> {
                try {
                    emailService.sendSimple(to, title, html);
                } catch (Exception ignored) {
                    // best-effort; the in-app notification is already saved
                }
            });
        }
    }
}
