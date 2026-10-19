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

    /** Business analytics for the admin dashboard (revenue, bookings, top movies/cinemas, occupancy, peak hours). */
    @GetMapping("/analytics")
    public Map<String, Object> analytics(@RequestParam(defaultValue = "30") int days) {
        int d = Math.max(1, Math.min(days, 365));
        String today = "(now() at time zone 'Asia/Kolkata')::date";
        Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("days", d);
        out.put("totals", db.queryForMap(
                "select coalesce(sum(b.amount) filter (where b.status='CONFIRMED'),0) revenue," +
                        " count(*) filter (where b.status='CONFIRMED') bookings," +
                        " (select count(*) from booking_seats bs2 join bookings b3 on b3.id=bs2.booking_id where b3.status='CONFIRMED' and (b3.created_at at time zone 'Asia/Kolkata')::date > " + today + " - " + d + ") tickets," +
                        " count(*) filter (where b.status='CANCELLED') cancelled," +
                        " count(*) filter (where b.status='REFUNDED') refunded," +
                        " coalesce(avg(b.amount) filter (where b.status='CONFIRMED'),0) avg_order," +
                        " coalesce(sum(b.amount) filter (where b.status='CONFIRMED' and (b.created_at at time zone 'Asia/Kolkata')::date = " + today + "),0) revenue_today," +
                        " (select count(*) from users) users," +
                        " (select count(*) from waitlist where notified_at is null) waitlisted," +
                        " (select count(*) from watchlist_movies) watchlisted " +
                        "from bookings b where (b.created_at at time zone 'Asia/Kolkata')::date > " + today + " - " + d));
        out.put("daily", db.queryForList(
                "select to_char(g.dt,'YYYY-MM-DD') label, count(b.id) bookings, coalesce(sum(b.amount),0) revenue " +
                        "from generate_series(" + today + " - " + (d - 1) + ", " + today + ", interval '1 day') g(dt) " +
                        "left join bookings b on b.status='CONFIRMED' and (b.created_at at time zone 'Asia/Kolkata')::date = g.dt::date " +
                        "group by g.dt order by g.dt"));
        out.put("topMovies", db.queryForList(
                "select m.title, count(distinct b.id) bookings, count(bs.id) tickets, " +
                        "(select coalesce(sum(b2.amount),0) from bookings b2 join shows s2 on s2.id=b2.show_id where s2.movie_id=m.id and b2.status='CONFIRMED' " +
                        " and (b2.created_at at time zone 'Asia/Kolkata')::date > " + today + " - " + d + ") revenue " +
                        "from bookings b join shows sh on sh.id=b.show_id join movies m on m.id=sh.movie_id " +
                        "join booking_seats bs on bs.booking_id=b.id where b.status='CONFIRMED' " +
                        "and (b.created_at at time zone 'Asia/Kolkata')::date > " + today + " - " + d + " " +
                        "group by m.id, m.title order by tickets desc limit 8"));
        out.put("topTheatres", db.queryForList(
                "select t.name, c.name city, count(b.id) bookings, coalesce(sum(b.amount),0) revenue " +
                        "from bookings b join shows sh on sh.id=b.show_id join screens sc on sc.id=sh.screen_id " +
                        "join theatres t on t.id=sc.theatre_id left join cities c on c.id=t.city_id " +
                        "where b.status='CONFIRMED' and (b.created_at at time zone 'Asia/Kolkata')::date > " + today + " - " + d + " " +
                        "group by t.id, t.name, c.name order by revenue desc limit 8"));
        out.put("peakHours", db.queryForList(
                "select extract(hour from sh.start_time)::int hr, count(b.id) bookings from bookings b join shows sh on sh.id=b.show_id " +
                        "where b.status='CONFIRMED' and (b.created_at at time zone 'Asia/Kolkata')::date > " + today + " - " + d + " " +
                        "group by 1 order by 1"));
        out.put("occupancy", db.queryForMap(
                "select coalesce(round(100.0 * count(*) filter (where ss.status in ('BOOKED','LOCKED')) / nullif(count(*),0), 1),0) fill_percent, " +
                        "count(distinct sh.id) shows from shows sh join show_seats ss on ss.show_id=sh.id " +
                        "where sh.show_date between " + today + " and " + today + " + 6"));
        out.put("paymentMix", db.queryForList(
                "select case when razorpay_payment_id like 'WALLET-%' then 'Wallet' when razorpay_payment_id like 'MOCK-%' then 'Demo checkout' else 'Razorpay' end method, " +
                        "count(*) bookings, coalesce(sum(amount),0) revenue from bookings where status='CONFIRMED' " +
                        "and (created_at at time zone 'Asia/Kolkata')::date > " + today + " - " + d + " group by 1 order by 3 desc"));
        return out;
    }

    @GetMapping("/theatres")
    public List<Map<String, Object>> theatres() {
        return db.queryForList(
                "select t.id, t.name, t.address, t.latitude, t.longitude, c.name city_name from theatres t " +
                        "join cities c on c.id = t.city_id where t.active=true order by c.name, t.name");
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
                "insert into theatres(name,address,city_id,latitude,longitude,theatre_type) values(?,?,?,?,?,?) returning id",
                Long.class,
                body.get("name"), body.get("address"), body.get("cityId"),
                body.get("latitude"), body.get("longitude"),
                "MULTIPLEX".equalsIgnoreCase(String.valueOf(body.get("theatreType"))) ? "MULTIPLEX" : "SINGLE");
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
                        "join theatres t on t.id = s.theatre_id where t.active=true order by t.name, s.name");
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
        totalSeats = Math.max(totalSeats, 150); // the seat layout is always 10 rows (A-J) x 15 seats

        long id = db.queryForObject(
                "insert into shows(movie_id,screen_id,show_date,start_time,end_time,price,format,language) " +
                        "values(?,?,?,?,?,?,?,(select language from movies where id=?)) returning id",
                Long.class,
                body.get("movieId"), screenId,
                LocalDate.parse(body.get("date").toString()),
                LocalTime.parse(body.get("start").toString()),
                LocalTime.parse(body.get("end").toString()),
                // Price is fixed by theatre type (Rs 100 single screen / Rs 150 multiplex, class multipliers on top).
                db.queryForObject("select case when t.theatre_type='MULTIPLEX' then 150 else 100 end " +
                        "from screens sc join theatres t on t.id=sc.theatre_id where sc.id=?", Integer.class, screenId),
                "3D".equalsIgnoreCase(String.valueOf(body.get("format"))) ? "3D" : "2D",
                body.get("movieId"));

        // First third of seats are PREMIUM, the rest REGULAR; 15 seats per row (A1-A15, B1-B15, ...).
        int premiumCount = Math.max(1, totalSeats / 3);
        for (int seat = 1; seat <= totalSeats; seat++) {
            String seatNumber = "" + (char) ('A' + (seat - 1) / 15) + ((seat - 1) % 15 + 1);
            String seatType = seat <= premiumCount ? "PREMIUM" : "REGULAR";
            db.update("insert into show_seats(show_id,seat_number,seat_type) values(?,?,?)", id, seatNumber, seatType);
        }
        return Map.of("id", id, "totalSeats", totalSeats);
    }
}
