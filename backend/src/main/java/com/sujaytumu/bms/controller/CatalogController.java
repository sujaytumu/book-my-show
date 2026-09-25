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

    @GetMapping("/api/shows")
    public List<Map<String, Object>> shows(@RequestParam long movieId, @RequestParam(required = false) String date) {
        String sql = "select sh.*,t.name theatre_name,s.name screen_name from shows sh " +
                "join screens s on s.id=sh.screen_id join theatres t on t.id=s.theatre_id where sh.movie_id=? ";
        if (date == null) {
            return db.queryForList(sql + "order by show_date,start_time", movieId);
        }
        return db.queryForList(sql + "and show_date=? order by start_time", movieId, LocalDate.parse(date));
    }

    @GetMapping("/api/shows/{id}/seats")
    public List<Map<String, Object>> seats(@PathVariable long id) {
        return db.queryForList(
                "select id,seat_number,seat_type,status from show_seats where show_id=? order by seat_number", id);
    }
}
