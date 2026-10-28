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
        String base = "select m.*,coalesce(m.votes_base,0) + coalesce(rv.c,0) votes from movies m " +
                "left join (select movie_id,count(*) c from reviews group by movie_id) rv on rv.movie_id=m.id where m.active=true ";
        List<Map<String, Object>> rows = (q == null || q.isBlank())
                ? db.queryForList(base + "order by m.title")
                : db.queryForList(base + "and m.title ilike ? order by m.title", "%" + q + "%");
        // The list never shows cast and crew (the movie page loads it on its own); it is the heaviest column, so leave it out.
        for (Map<String, Object> r : rows) {
            Object cast = r.remove("cast_crew");
            r.put("has_cast", cast != null && !String.valueOf(cast).isBlank());
        }
        return rows;
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
                "coalesce(c.total_seats,0) total_seats,coalesce(c.available_seats,0) available_seats " +
                "from shows sh " +
                // one pass over this movie's seats instead of two subqueries per show row
                "left join (select show_id,count(*) total_seats,count(*) filter (where status='AVAILABLE') available_seats " +
                "from show_seats where show_id in (select id from shows where movie_id=?) group by show_id) c on c.show_id=sh.id " +

                "join screens s on s.id=sh.screen_id join theatres t on t.id=s.theatre_id " +
                "where sh.movie_id=? and t.active=true and sh.show_date>=(now() at time zone 'Asia/Kolkata')::date " +
                "and (sh.show_date + sh.start_time) > (now() at time zone 'Asia/Kolkata') ";
        java.util.List<Object> args = new java.util.ArrayList<>();
        args.add(movieId);
        args.add(movieId);
        // Optional city filter (the city picked in the app); no city = every cinema, as before.
        if (city != null && !city.isBlank()) {
            sql += "and exists(select 1 from cities c where c.id=t.city_id and lower(c.name)=lower(?)) ";
            args.add(city.trim());
        }
        List<Map<String, Object>> rows;
        if (date == null) {
            rows = db.queryForList(sql + "order by t.name,show_date,start_time", args.toArray());
        } else {
            args.add(LocalDate.parse(date));
            rows = db.queryForList(sql + "and show_date=? order by t.name,start_time", args.toArray());
        }
        addCrowdForecast(rows);
        return rows;
    }

    /** Adds a "crowd" object (level, label, projected fill, tip) to every show row. */
    private static void addCrowdForecast(List<Map<String, Object>> rows) {
        java.time.LocalDateTime now = java.time.LocalDateTime.now(java.time.ZoneId.of("Asia/Kolkata"));
        for (Map<String, Object> r : rows) {
            try {
                java.time.LocalDate d = ((java.sql.Date) r.get("show_date")).toLocalDate();
                java.time.LocalTime t = ((java.sql.Time) r.get("start_time")).toLocalTime();
                var f = com.sujaytumu.bms.service.CrowdForecast.forecast(now, d, t,
                        ((Number) r.get("total_seats")).intValue(), ((Number) r.get("available_seats")).intValue());
                if (f != null) r.put("crowd", f);
            } catch (RuntimeException ignored) {
                // forecast is a nicety; never break the show list
            }
        }
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

    /** Cinemas in a city with what is playing in the coming days (movies as "id:title|id:title"). */
    @GetMapping("/api/theatres")
    public List<Map<String, Object>> theatres(@RequestParam(required = false) String city) {
        String sql = "select t.id, t.name, t.address, t.theatre_type, t.cancellable, c.name city, " +
                "(select string_agg(distinct m.id || ':' || m.title, '|') from shows sh join screens s on s.id=sh.screen_id " +
                "join movies m on m.id=sh.movie_id where s.theatre_id=t.id and m.upcoming=false and m.active=true " +
                "and sh.show_date>=(now() at time zone 'Asia/Kolkata')::date) movies " +
                "from theatres t left join cities c on c.id=t.city_id where t.active=true ";
        if (city != null && !city.isBlank()) {
            return db.queryForList(sql + "and lower(c.name)=lower(?) order by t.name", city.trim());
        }
        return db.queryForList(sql + "order by t.name");
    }

    @GetMapping("/api/shows/{id}/seats")
    public List<Map<String, Object>> seats(@PathVariable long id) {
        return db.queryForList(
                "select id,seat_number,seat_type,status from show_seats where show_id=? order by seat_number", id);
    }

    /**
     * Smart seat picker: the best group of `count` seats for this show right now (centred, right depth, no lonely
     * single seats left behind), a couple of alternatives, and a 0-100 view-quality score for every free seat.
     * mode=view (default) maximises the view; mode=value trades the view against the class price.
     */
    @GetMapping("/api/shows/{id}/best-seats")
    public com.sujaytumu.bms.service.SeatAdvisor.Advice bestSeats(@PathVariable long id,
                                                                  @RequestParam(defaultValue = "2") int count,
                                                                  @RequestParam(defaultValue = "view") String mode) {
        String theatreType = db.queryForObject(
                "select t.theatre_type from shows sh join screens s on s.id=sh.screen_id " +
                        "join theatres t on t.id=s.theatre_id where sh.id=?", String.class, id);
        List<com.sujaytumu.bms.service.SeatAdvisor.Seat> seats = db.query(
                "select seat_number,status from show_seats where show_id=?",
                (rs, n) -> new com.sujaytumu.bms.service.SeatAdvisor.Seat(rs.getString(1), "AVAILABLE".equals(rs.getString(2))),
                id);
        return com.sujaytumu.bms.service.SeatAdvisor.advise(seats, count, mode, theatreType);
    }
}

