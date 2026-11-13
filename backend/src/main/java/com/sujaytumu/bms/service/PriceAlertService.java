package com.sujaytumu.bms.service;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

/** "Tell me when tickets for this movie cost X or less": one in-app notification when a matching upcoming show exists. */
@Service
public class PriceAlertService {

    private final JdbcTemplate db;

    public PriceAlertService(JdbcTemplate db) {
        this.db = db;
    }

    public Map<String, Object> get(String email, long movieId) {
        List<Map<String, Object>> rows = db.queryForList(
                "select a.max_price from price_alerts a join users u on u.id=a.user_id where u.email=? and a.movie_id=?", email, movieId);
        return rows.isEmpty() ? Map.of() : rows.get(0);
    }

    public void set(String email, long movieId, double maxPrice) {
        if (!(maxPrice >= 50 && maxPrice <= 2000)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a price between 50 and 2000");
        Long exists = db.queryForObject("select count(*) from movies where id=?", Long.class, movieId);
        if (exists == null || exists == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Movie not found");
        // Changing the price re-arms the alert.
        db.update("insert into price_alerts(user_id,movie_id,max_price) select id, ?, ? from users where email=? " +
                "on conflict (user_id,movie_id) do update set max_price=excluded.max_price, notified=false", movieId, maxPrice, email);
    }

    public void remove(String email, long movieId) {
        db.update("delete from price_alerts a using users u where u.id=a.user_id and u.email=? and a.movie_id=?", email, movieId);
    }

    @Scheduled(initialDelay = 120_000, fixedDelay = 600_000)
    public void check() {
        try {
            notifyDue();
        } catch (Exception e) {
            System.err.println("[price-alerts] failed: " + e.getMessage());
        }
    }

    /** The cheapest upcoming show per alert, using the same price the showtime list displays (base + format fee). */
    int notifyDue() {
        List<Map<String, Object>> rows = db.queryForList("""
                select a.user_id, a.movie_id, a.max_price, m.title, sh.price, sh.format, sh.show_date
                from price_alerts a
                join movies m on m.id = a.movie_id and m.active = true
                join shows sh on sh.movie_id = a.movie_id
                where a.notified = false
                  and (sh.show_date + sh.start_time) > (now() at time zone 'Asia/Kolkata')
                """);
        // user|movie -> cheapest matching price
        java.util.Map<String, Double> best = new java.util.HashMap<>();
        java.util.Map<String, Map<String, Object>> meta = new java.util.HashMap<>();
        for (Map<String, Object> r : rows) {
            double price = ((Number) r.get("price")).doubleValue() + Pricing.formatFee((String) r.get("format"));
            if (price > ((Number) r.get("max_price")).doubleValue()) continue;
            String key = r.get("user_id") + "|" + r.get("movie_id");
            if (best.get(key) == null || price < best.get(key)) {
                best.put(key, price);
                meta.put(key, r);
            }
        }
        int sent = 0;
        for (Map.Entry<String, Double> e : best.entrySet()) {
            Map<String, Object> r = meta.get(e.getKey());
            int changed = db.update("update price_alerts set notified=true where user_id=? and movie_id=? and notified=false",
                    r.get("user_id"), r.get("movie_id"));
            if (changed == 0) continue;
            db.update("insert into user_notifications(user_id,kind,title,body,link) values(?,?,?,?,?)",
                    r.get("user_id"), "price", "Tickets from ₹" + Math.round(e.getValue()) + " for " + r.get("title"),
                    "Shows of " + r.get("title") + " are now available at or under your price of ₹"
                            + Math.round(((Number) r.get("max_price")).doubleValue()) + ". Book before they fill up.",
                    "/movie/" + r.get("movie_id"));
            sent++;
        }
        return sent;
    }
}
