package com.sujaytumu.bms.service;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/** Sold-out waitlist: users ask to be told when N seats open up on a show; first come, first served. */
@Service
public class WaitlistService {

    private final JdbcTemplate db;
    private final EmailService emailService;

    public WaitlistService(JdbcTemplate db, EmailService emailService) {
        this.db = db;
        this.emailService = emailService;
    }

    public Map<String, Object> status(String email, long showId) {
        long userId = userId(email);
        List<Map<String, Object>> rows = db.queryForList(
                "select seats_wanted from waitlist where user_id=? and show_id=?", userId, showId);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("onWaitlist", !rows.isEmpty());
        out.put("seats", rows.isEmpty() ? null : rows.get(0).get("seats_wanted"));
        out.put("available", availableSeats(showId));
        return out;
    }

    public Map<String, Object> join(String email, long showId, int seats) {
        if (seats < 1 || seats > 10) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose between 1 and 10 seats");
        }
        List<Boolean> started = db.queryForList(
                "select (show_date + start_time) <= (now() at time zone 'Asia/Kolkata') from shows where id=?",
                Boolean.class, showId);
        if (started.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Show not found");
        if (started.get(0)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This show has already started");
        if (availableSeats(showId) >= seats) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Seats are available right now - you can book them directly");
        }
        long userId = userId(email);
        db.update("insert into waitlist(user_id,show_id,seats_wanted) values(?,?,?) " +
                "on conflict (user_id,show_id) do update set seats_wanted=excluded.seats_wanted, notified_at=null, created_at=now()",
                userId, showId, seats);
        return status(email, showId);
    }

    public Map<String, Object> leave(String email, long showId) {
        db.update("delete from waitlist where user_id=? and show_id=?", userId(email), showId);
        return status(email, showId);
    }

    /** Called whenever seats of a show were released (cancellation or expired hold). */
    public void onSeatsFreed(long showId) {
        // One notifier per show at a time (released automatically at the end of the surrounding transaction).
        db.execute("select pg_advisory_xact_lock(" + showId + ")");
        List<Map<String, Object>> waiting = db.queryForList(
                "select w.id, w.seats_wanted, u.id user_id, u.email, m.title, t.name theatre_name, sh.show_date, sh.start_time " +
                        "from waitlist w join users u on u.id=w.user_id join shows sh on sh.id=w.show_id " +
                        "join movies m on m.id=sh.movie_id join screens sc on sc.id=sh.screen_id join theatres t on t.id=sc.theatre_id " +
                        "where w.show_id=? and w.notified_at is null and (sh.show_date + sh.start_time) > (now() at time zone 'Asia/Kolkata') " +
                        "order by w.created_at, w.id", showId);
        if (waiting.isEmpty()) return;
        long available = availableSeats(showId);
        for (Map<String, Object> w : waiting) {
            int wanted = ((Number) w.get("seats_wanted")).intValue();
            if (available < wanted) continue;
            available -= wanted;
            db.update("update waitlist set notified_at=now() where id=?", w.get("id"));
            String when = w.get("show_date") + " " + String.valueOf(w.get("start_time")).substring(0, 5);
            String title = "Seats available for " + w.get("title");
            String body = wanted + " seat" + (wanted == 1 ? "" : "s") + " just opened up at " + w.get("theatre_name")
                    + " (" + when + "). Book now before they are gone.";
            db.update("insert into user_notifications(user_id,kind,title,body,link) values(?,?,?,?,?)",
                    w.get("user_id"), "seats", title, body, "/show/" + showId);
            final String to = String.valueOf(w.get("email"));
            final String html = "<p>" + body + "</p><p>Open the Book My Show app to grab them.</p>";
            CompletableFuture.runAsync(() -> {
                try {
                    emailService.sendSimple(to, title, html);
                } catch (Exception ignored) {
                    // email is best-effort; the in-app notification is already saved
                }
            });
        }
    }

    public List<Map<String, Object>> notifications(String email) {
        return db.queryForList(
                "select id, kind, title, body, link, created_at from user_notifications where user_id=? order by created_at desc, id desc limit 50",
                userId(email));
    }

    private long availableSeats(long showId) {
        Long n = db.queryForObject(
                "select count(*) from show_seats where show_id=? and status='AVAILABLE'", Long.class, showId);
        return n == null ? 0 : n;
    }

    private long userId(String email) {
        Long id = db.queryForObject("select id from users where email=?", Long.class, email);
        if (id == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please log in again");
        return id;
    }
}
