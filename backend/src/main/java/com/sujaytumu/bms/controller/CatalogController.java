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
            return db.queryForList("select * from movies where active=true order by title");
        }
        return db.queryForList("select * from movies where active=true and title ilike ? order by title", "%" + q + "%");
    }

    @GetMapping("/api/movies/{id}")
    public Map<String, Object> movie(@PathVariable long id) {
        return db.queryForMap("select * from movies where id=?", id);
    }

    // Real (client-supplied) geolocation is used for "distance from me", computed
    // in the browser via TheatreMap.haversineKm - no server-side fixed reference
    // point. This just returns each theatre's lat/lng so the frontend can do that.
    // "and sh.show_date>=current_date" keeps past dates out of the browsing list -
    // ShowWindowScheduler is what keeps the *future* end of the window rolling
    // forward daily so this doesn't just shrink down to nothing over time.
    @GetMapping("/api/shows")
    public List<Map<String, Object>> shows(@RequestParam long movieId, @RequestParam(required = false) String date) {
        String sql = "select sh.*,t.id theatre_id,t.name theatre_name,t.address theatre_address,t.latitude,t.longitude," +
                "s.name screen_name from shows sh " +
                "join screens s on s.id=sh.screen_id join theatres t on t.id=s.theatre_id " +
                "where sh.movie_id=? and t.active=true and sh.show_date>=current_date " +
                "and (sh.show_date + sh.start_time) > (now() at time zone 'Asia/Kolkata') ";
        if (date == null) {
            return db.queryForList(sql + "order by t.name,show_date,start_time", movieId);
        }
        return db.queryForList(sql + "and show_date=? order by t.name,start_time", movieId, LocalDate.parse(date));
    }

    @GetMapping("/api/shows/{id}")
    public Map<String, Object> show(@PathVariable long id) {
        return db.queryForMap(
                "select sh.*, m.title movie_title, t.name theatre_name, t.latitude, t.longitude, s.name screen_name " +
                        "from shows sh join movies m on m.id=sh.movie_id " +
                        "join screens s on s.id=sh.screen_id join theatres t on t.id=s.theatre_id " +
                        "where sh.id=?", id);
    }

    @GetMapping("/api/shows/{id}/seats")
    public List<Map<String, Object>> seats(@PathVariable long id) {
        return db.queryForList(
                "select id,seat_number,seat_type,status from show_seats where show_id=? order by seat_number", id);
    }
}

