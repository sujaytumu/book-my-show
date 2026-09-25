package com.sujaytumu.bms.controller;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final JdbcTemplate db;

    public AdminController(JdbcTemplate db) {
        this.db = db;
    }

    @GetMapping("/screens")
    public List<Map<String, Object>> screens() {
        return db.queryForList(
                "select s.id, s.name, s.total_seats, t.name theatre_name from screens s " +
                        "join theatres t on t.id = s.theatre_id order by t.name, s.name");
    }

    @PostMapping("/movies")
    public Map<String, String> addMovie(@RequestBody Map<String, Object> body) {
        db.update("insert into movies(title,description,poster_url,language,genre,duration_minutes,certificate,rating) " +
                        "values(?,?,?,?,?,?,?,?)",
                body.get("title"), body.get("description"), body.get("posterUrl"), body.get("language"),
                body.get("genre"), body.get("durationMinutes"), body.get("certificate"), body.get("rating"));
        return Map.of("status", "created");
    }

    @PostMapping("/shows")
    public Map<String, Object> addShow(@RequestBody Map<String, Object> body) {
        long id = db.queryForObject(
                "insert into shows(movie_id,screen_id,show_date,start_time,end_time,price) values(?,?,?,?,?,?) returning id",
                Long.class,
                body.get("movieId"), body.get("screenId"),
                LocalDate.parse(body.get("date").toString()),
                LocalTime.parse(body.get("start").toString()),
                LocalTime.parse(body.get("end").toString()),
                body.get("price"));

        for (int seat = 1; seat <= 60; seat++) {
            String seatNumber = "" + (char) ('A' + (seat - 1) / 10) + ((seat - 1) % 10 + 1);
            String seatType = seat <= 20 ? "PREMIUM" : "REGULAR";
            db.update("insert into show_seats(show_id,seat_number,seat_type) values(?,?,?)", id, seatNumber, seatType);
        }
        return Map.of("id", id);
    }
}
