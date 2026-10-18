package com.sujaytumu.bms.controller;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
public class CatalogController {

    private final JdbcTemplate db;

    public CatalogController(JdbcTemplate db) {
        this.db = db;
    }

    @GetMapping("/api/health")
    public Map<String, String> health() {
        return Map.of("status", "UP", "service", "book-my-show-api");
    }

    @GetMapping("/api/cities")
    public List<Map<String, Object>> cities() {
        return db.queryForList("select id,name from cities order by name");
    }

    @GetMapping("/api/movies")
    public List<Map<String, Object>> movies(@RequestParam(required = false) String q) {
        if (q == null || q.isBlank()) {
            return db.queryForList("select m.*,(coalesce(m.votes_base,0) + (select count(*) from reviews r where r.movie_id=m.id)) votes from movies m where m.active=true order by m.title");
        }
        return db.queryForList("select m.*,(coalesce(m.votes_base,0) + (select count(*) from reviews r where r.movie_id=m.id)) votes from movies m where m.active=true and m.title ilike ? order by m.title", "%" + q + "%");
    }

    @GetMapping("/api/movies/{id}")
    public Map<String, Object> movie(@PathVariable long id) {
        Map<String, Object> movie = db.queryForMap("select * from movies where id=?", id);
        // Real demand figure: seats in CONFIRMED bookings over the last 24 hours, averaged per hour.
        Long sold = db.queryForObject(
                "select count(*) from booking_seats bs join bookings b on b.id=bs.booking_id " +
                        "join shows sh on sh.id=b.show_id " +
                        "where sh.movie_id=? and b.status='CONFIRMED' and b.created_at > now() - interval '24 hours'",
                Long.class, id);
        movie.put("tickets_per_hour", Math.round((sold == null ? 0 : sold) / 24.0 * 10.0) / 10.0);
        // Seats in CONFIRMED bookings made in the last 60 minutes (the "Trending" banner).
        Long lastHour = db.queryForObject(
                "select count(*) from booking_seats bs join bookings b on b.id=bs.booking_id " +
                        "join shows sh on sh.id=b.show_id " +
                        "where sh.movie_id=? and b.status='CONFIRMED' and b.created_at > now() - interval '1 hour'",
                Long.class, id);
        // This is a small cinema network, so numbers are modest: a steady baseline of roughly
        // 10-20 tickets/hour and 100-140 per 24 hours (it varies by movie and hour of day, but is
        // stable between refreshes), plus every real confirmed booking on top of it.
        int hourOfDay = java.time.LocalTime.now(java.time.ZoneId.of("Asia/Kolkata")).getHour();
        long baseHour = 10 + Math.floorMod(id * 7 + hourOfDay * 3L, 11L);
        Object vb = movie.get("votes_base");
        if (vb instanceof Number && ((Number) vb).longValue() > 0) {
            // Scale with how popular the movie is: tens or hundreds of tickets per hour, like the real app.
            double wobble = 0.7 + 0.6 * Math.floorMod(id * 7 + hourOfDay * 3L, 11L) / 10.0;
            baseHour = Math.round(((Number) vb).doubleValue() / 12.0 * wobble);
        }
        long votesTotal = (vb instanceof Number ? ((Number) vb).longValue() : 0)
                + db.queryForObject("select count(*) from reviews where movie_id=?", Long.class, id);
        movie.put("votes", votesTotal);
        long baseDay = 100 + Math.floorMod(id * 17, 41L);
        movie.put("tickets_last_hour", (lastHour == null ? 0 : lastHour) + baseHour);
        movie.put("tickets_last_day", (sold == null ? 0 : sold) + baseDay);
        return movie;
    }

    // Real (client-supplied) geolocation is used for "distance from me", computed
    // in the browser via TheatreMap.haversineKm - no server-side fixed reference
    // point. This just returns each theatre's lat/lng so the frontend can do that.
    // "and sh.show_date>=current_date" keeps past dates out of the browsing list -
    // ShowWindowScheduler is what keeps the *future* end of the window rolling
    // forward daily so this doesn't just shrink down to nothing over time.
    @GetMapping("/api/shows")
    public List<Map<String, Object>> shows(@RequestParam long movieId, @RequestParam(required = false) String date,
                                           @RequestParam(required = false) String city) {
        String sql = "select sh.*,t.id theatre_id,t.theatre_type,t.cancellable,t.name theatre_name,t.address theatre_address,t.latitude,t.longitude," +
                
                "s.name screen_name," +
                "(select count(*) from show_seats ss where ss.show_id=sh.id) total_seats," +
                "(select count(*) from show_seats ss where ss.show_id=sh.id and ss.status='AVAILABLE') available_seats " +
                "from shows sh " +

                "join screens s on s.id=sh.screen_id join theatres t on t.id=s.theatre_id " +
                "where sh.movie_id=? and t.active=true and sh.show_date>=(now() at time zone 'Asia/Kolkata')::date " +
                "and (sh.show_date + sh.start_time) > (now() at time zone 'Asia/Kolkata') ";
        java.util.List<Object> args = new java.util.ArrayList<>();
        args.add(movieId);
        // Optional city filter (the city picked in the app); no city = every cinema, as before.
        if (city != null && !city.isBlank()) {
            sql += "and exists(select 1 from cities c where c.id=t.city_id and lower(c.name)=lower(?)) ";
            args.add(city.trim());
        }
        if (date == null) {
            return db.queryForList(sql + "order by t.name,show_date,start_time", args.toArray());
        }
        args.add(LocalDate.parse(date));
        return db.queryForList(sql + "and show_date=? order by t.name,start_time", args.toArray());
    }

    @GetMapping("/api/shows/{id}")
    public Map<String, Object> show(@PathVariable long id) {
        Map<String, Object> show = db.queryForMap(
                "select sh.*, m.title movie_title, t.name theatre_name, t.theatre_type, t.latitude, t.longitude, s.name screen_name " +
                        "from shows sh join movies m on m.id=sh.movie_id " +
                        "join screens s on s.id=sh.screen_id join theatres t on t.id=s.theatre_id " +
                        "where sh.id=?", id);
        // Per-class prices (Recliner / Balcony / Second Class / Dress Class) for the seat picker.
        show.put("class_prices", com.sujaytumu.bms.service.Pricing.classPrices((String) show.get("theatre_type")));
        return show;
    }

    /** Active offers shown on the booking page (code + description only). */
    @GetMapping("/api/coupons")
    public List<Map<String, Object>> coupons() {
        return db.queryForList("select code, description from coupons where active=true order by code");
    }

    /** Snacks and drinks that can be added to a booking. */
    @GetMapping("/api/food")
    public List<Map<String, Object>> food() {
        return db.queryForList("select id, name, description, price, veg from food_items where active=true order by id");
    }

    @GetMapping("/api/shows/{id}/seats")
    public List<Map<String, Object>> seats(@PathVariable long id) {
        return db.queryForList(
                "select id,seat_number,seat_type,status from show_seats where show_id=? order by seat_number", id);
    }
}

