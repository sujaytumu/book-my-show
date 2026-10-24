package com.sujaytumu.bms.controller;

import com.sujaytumu.bms.service.MovieEnricher;
import com.sujaytumu.bms.service.MovieLookupService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final JdbcTemplate db;
    private final MovieLookupService lookup;
    private final MovieEnricher enricher;

    public AdminController(JdbcTemplate db, MovieLookupService lookup, MovieEnricher enricher) {
        this.db = db;
        this.lookup = lookup;
        this.enricher = enricher;
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

    /** Consistency check of seats vs bookings. Every number should be 0 on a healthy system. */
    @GetMapping("/integrity")
    public Map<String, Object> integrity() {
        Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("seatsBookedWithoutBooking", db.queryForObject(
                "select count(*) from show_seats ss where ss.status='BOOKED' and not exists (" +
                        "select 1 from booking_seats bs join bookings b on b.id=bs.booking_id " +
                        "where b.show_id=ss.show_id and bs.seat_number=ss.seat_number and b.status='CONFIRMED')", Long.class));
        out.put("confirmedSeatsNotBooked", db.queryForObject(
                "select count(*) from booking_seats bs join bookings b on b.id=bs.booking_id join show_seats ss " +
                        "on ss.show_id=b.show_id and ss.seat_number=bs.seat_number where b.status='CONFIRMED' and ss.status<>'BOOKED'", Long.class));
        out.put("doubleBookedSeats", db.queryForObject(
                "select count(*) from (select b.show_id, bs.seat_number from booking_seats bs join bookings b on b.id=bs.booking_id " +
                        "where b.status='CONFIRMED' group by 1,2 having count(*)>1) x", Long.class));
        out.put("staleLocks", db.queryForObject(
                "select count(*) from show_seats where status='LOCKED' and locked_until < now() - interval '5 minutes'", Long.class));
        out.put("stuckPendingBookings", db.queryForObject(
                "select count(*) from bookings where status='PENDING' and expires_at < now() - interval '5 minutes'", Long.class));
        out.put("negativeWallets", db.queryForObject("select count(*) from users where wallet_balance < 0", Long.class));
        long bad = 0;
        for (Object v : out.values()) bad += ((Number) v).longValue();
        out.put("healthy", bad == 0);
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

    private static Object nz(Object v) {
        return v == null || String.valueOf(v).isBlank() ? null : v;
    }

    private static Integer intOrNull(Object v) {
        try {
            return nz(v) == null ? null : (int) Math.round(Double.parseDouble(String.valueOf(v).trim()));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static java.math.BigDecimal decOrNull(Object v) {
        try {
            return nz(v) == null ? null : new java.math.BigDecimal(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Run a movie-database call; turn "not set up" / "could not reach it" into a clear message for the admin screen. */
    private <T> T lookupCall(Supplier<T> call) {
        if (!lookup.configured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Movie lookup is not set up yet. Add TMDB_API_KEY (free at themoviedb.org) to the server settings.");
        }
        try {
            return call.get();
        } catch (MovieLookupService.LookupException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, e.getMessage());
        }
    }

    /**
     * Add a movie by hand. Anything left blank (poster, description, language, genre, runtime, certificate, release
     * date, cast) is filled in automatically from the movie database using the title, when lookup is set up.
     */
    @PostMapping("/movies")
    public Map<String, Object> addMovie(@RequestBody Map<String, Object> body) {
        Object title = nz(body.get("title"));
        if (title == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Movie title is required.");
        java.sql.Date release = null;
        if (nz(body.get("releaseDate")) != null) {
            try {
                release = java.sql.Date.valueOf(String.valueOf(body.get("releaseDate")).trim());
            } catch (IllegalArgumentException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Release date must look like 2026-10-16.");
            }
        }
        boolean upcoming = release != null && release.toLocalDate().isAfter(LocalDate.now(java.time.ZoneId.of("Asia/Kolkata")));
        Long id = db.queryForObject(
                "insert into movies(title,description,poster_url,language,genre,duration_minutes,certificate,rating,release_date,upcoming) " +
                        "values(?,?,?,?,?,?,?,?,?,?) returning id", Long.class,
                String.valueOf(title).trim(), nz(body.get("description")), nz(body.get("posterUrl")), nz(body.get("language")),
                nz(body.get("genre")), intOrNull(body.get("durationMinutes")), nz(body.get("certificate")),
                decOrNull(body.get("rating")) == null ? java.math.BigDecimal.ZERO : decOrNull(body.get("rating")), release, upcoming);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("status", "created");
        out.put("id", id);
        if (enricher.configured()) {
            try {
                MovieEnricher.Result r = enricher.enrich(id, false, false);
                out.put("autoFill", r);
            } catch (RuntimeException e) {
                out.put("autoFillNote", "Added, but the automatic fill could not run: " + e.getMessage());
            }
        } else {
            out.put("autoFillNote", "Added. Set TMDB_API_KEY on the server and the poster, cast and dates fill in by themselves.");
        }
        return out;
    }

    /** Search the movie database by name (the admin screen shows these as pickable cards). */
    @GetMapping("/movies/lookup")
    public Map<String, Object> lookupMovies(@RequestParam String query, @RequestParam(required = false) Integer year) {
        if (query == null || query.trim().length() < 2) return Map.of("results", List.of());
        return Map.of("results", lookupCall(() -> lookup.search(query, year)));
    }

    /** Everything we would save for one search result, so the admin can look before adding. */
    @GetMapping("/movies/lookup/{tmdbId}")
    public MovieLookupService.Details previewMovie(@PathVariable long tmdbId) {
        return lookupCall(() -> lookup.details(tmdbId));
    }

    /** Add the picked film with every detail (poster, language, genre, runtime, certificate, release date, cast and crew). */
    @PostMapping("/movies/from-lookup")
    public Map<String, Object> addFromLookup(@RequestBody Map<String, Object> body) {
        Integer tmdbId = intOrNull(body.get("tmdbId"));
        if (tmdbId == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pick a movie first.");
        return lookupCall(() -> enricher.createFromLookup(tmdbId));
    }

    /**
     * Fill the blanks of a movie that already exists (or refresh everything with overwrite=true). When the title is
     * ambiguous the response carries suggestions; sending {"tmdbId": ...} links the chosen one.
     */
    @PostMapping("/movies/{id}/auto-fill")
    public MovieEnricher.Result autoFill(@PathVariable long id, @RequestParam(defaultValue = "false") boolean overwrite,
                                         @RequestBody(required = false) Map<String, Object> body) {
        Integer chosen = body == null ? null : intOrNull(body.get("tmdbId"));
        if (chosen != null) {
            try {
                db.update("update movies set tmdb_id = ? where id = ?", chosen, id);
            } catch (org.springframework.dao.DuplicateKeyException e) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "That film is already in the catalogue as another movie.");
            }
        }
        return lookupCall(() -> enricher.enrich(id, overwrite, false));
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
