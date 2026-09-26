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

    @GetMapping("/theatres")
    public List<Map<String, Object>> theatres() {
        return db.queryForList(
                "select t.id, t.name, t.address, t.latitude, t.longitude, c.name city_name from theatres t " +
                        "join cities c on c.id = t.city_id order by c.name, t.name");
    }

    @PostMapping("/cities")
    public Map<String, Object> addCity(@RequestBody Map<String, Object> body) {
        long id = db.queryForObject(
                "insert into cities(name) values(?) on conflict(name) do update set name=excluded.name returning id",
                Long.class, body.get("name"));
        return Map.of("id", id);
    }

    @PostMapping("/theatres")
    public Map<String, Object> addTheatre(@RequestBody Map<String, Object> body) {
        long id = db.queryForObject(
                "insert into theatres(name,address,city_id,latitude,longitude) values(?,?,?,?,?) returning id",
                Long.class,
                body.get("name"), body.get("address"), body.get("cityId"),
                body.get("latitude"), body.get("longitude"));
        return Map.of("id", id);
    }

    @PostMapping("/screens")
    public Map<String, Object> addScreen(@RequestBody Map<String, Object> body) {
        long id = db.queryForObject(
                "insert into screens(name,total_seats,theatre_id) values(?,?,?) returning id",
                Long.class, body.get("name"), body.get("totalSeats"), body.get("theatreId"));
        return Map.of("id", id);
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
        long screenId = ((Number) body.get("screenId")).longValue();
        int totalSeats = db.queryForObject("select total_seats from screens where id=?", Integer.class, screenId);

        long id = db.queryForObject(
                "insert into shows(movie_id,screen_id,show_date,start_time,end_time,price) values(?,?,?,?,?,?) returning id",
                Long.class,
                body.get("movieId"), screenId,
                LocalDate.parse(body.get("date").toString()),
                LocalTime.parse(body.get("start").toString()),
                LocalTime.parse(body.get("end").toString()),
                body.get("price"));

        // First third of seats are PREMIUM, the rest REGULAR; 10 seats per row (A1-A10, B1-B10, ...).
        int premiumCount = Math.max(1, totalSeats / 3);
        for (int seat = 1; seat <= totalSeats; seat++) {
            String seatNumber = "" + (char) ('A' + (seat - 1) / 10) + ((seat - 1) % 10 + 1);
            String seatType = seat <= premiumCount ? "PREMIUM" : "REGULAR";
            db.update("insert into show_seats(show_id,seat_number,seat_type) values(?,?,?)", id, seatNumber, seatType);
        }
        return Map.of("id", id, "totalSeats", totalSeats);
    }
}
