package com.sujaytumu.bms.service;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Owns the seat-locking / booking-lifecycle logic.
 *
 * The core guarantee: when two users race for the same seat, the transactional
 * SELECT ... FOR UPDATE on show_seats serialises the competing hold attempts at
 * the database level, so a seat can never be successfully allocated twice.
 */
@Service
public class BookingService {

    private static final int MAX_SEATS_PER_BOOKING = 10;
    private static final long HOLD_SECONDS = 600; // 10 minutes

    private final JdbcTemplate db;

    public BookingService(JdbcTemplate db) {
        this.db = db;
    }

    @Transactional
    public Map<String, Object> holdSeats(String email, long showId, List<String> rawSeatNumbers) {
        List<String> seatNumbers = rawSeatNumbers.stream().distinct().toList();
        if (seatNumbers.isEmpty() || seatNumbers.size() > MAX_SEATS_PER_BOOKING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Select between 1 and " + MAX_SEATS_PER_BOOKING + " seats");
        }

        String placeholders = String.join(",", Collections.nCopies(seatNumbers.size(), "?"));
        Object[] params = new Object[seatNumbers.size() + 1];
        params[0] = showId;
        for (int i = 0; i < seatNumbers.size(); i++) params[i + 1] = seatNumbers.get(i);

        List<Map<String, Object>> rows = db.queryForList(
                "select * from show_seats where show_id=? and seat_number in (" + placeholders + ") for update",
                params);
        if (rows.size() != seatNumbers.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "One or more seats do not exist on this show");
        }

        Instant now = Instant.now();
        for (Map<String, Object> row : rows) {
            String status = (String) row.get("status");
            Timestamp lockedUntil = (Timestamp) row.get("locked_until");
            boolean stillLocked = "LOCKED".equals(status) && lockedUntil != null && lockedUntil.toInstant().isAfter(now);
            if ("BOOKED".equals(status) || stillLocked) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "One or more selected seats are no longer available");
            }
        }

        long userId = ((Number) db.queryForMap("select id from users where email=?", email).get("id")).longValue();
        double price = ((Number) db.queryForMap("select price from shows where id=?", showId).get("price")).doubleValue();
        double amount = price * seatNumbers.size();
        Instant expiresAt = now.plusSeconds(HOLD_SECONDS);
        String reference = "BMS-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        long bookingId = db.queryForObject(
                "insert into bookings(user_id,show_id,reference,status,amount,expires_at) values(?,?,?,'PENDING',?,?) returning id",
                Long.class, userId, showId, reference, amount, Timestamp.from(expiresAt));

        for (String seatNumber : seatNumbers) {
            db.update("insert into booking_seats(booking_id,seat_number) values(?,?)", bookingId, seatNumber);
            db.update("update show_seats set status='LOCKED',locked_by=?,locked_until=? where show_id=? and seat_number=?",
                    bookingId, Timestamp.from(expiresAt), showId, seatNumber);
        }

        return Map.of(
                "bookingId", bookingId,
                "reference", reference,
                "amount", amount,
                "expiresAt", expiresAt.toString(),
                "seats", seatNumbers);
    }

    public Map<String, Object> bookingForPayment(String email, long bookingId) {
        return db.queryForMap(
                "select b.* from bookings b join users u on u.id=b.user_id where b.id=? and u.email=?",
                bookingId, email);
    }

    public Map<String, Object> bookingByOrderId(String email, String razorpayOrderId) {
        return db.queryForMap(
                "select b.* from bookings b join users u on u.id=b.user_id where b.razorpay_order_id=? and u.email=?",
                razorpayOrderId, email);
    }

    public boolean holdStillValid(long bookingId) {
        Integer count = db.queryForObject(
                "select count(*) from bookings where id=? and expires_at>now() and status='PENDING'",
                Integer.class, bookingId);
        return count != null && count > 0;
    }

    @Transactional
    public void confirmBooking(long bookingId, String razorpayPaymentId) {
        db.update("update bookings set status='CONFIRMED',razorpay_payment_id=? where id=?", razorpayPaymentId, bookingId);
        db.update("update show_seats set status='BOOKED',locked_by=null,locked_until=null where locked_by=?", bookingId);
    }

    public List<Map<String, Object>> myBookings(String email) {
        return db.queryForList("""
                select b.id, b.reference, b.status, b.amount, b.created_at, m.title,
                       sh.show_date, sh.start_time, t.name theatre_name,
                       string_agg(bs.seat_number, ', ' order by bs.seat_number) seats
                from bookings b
                join users u on u.id = b.user_id
                join shows sh on sh.id = b.show_id
                join movies m on m.id = sh.movie_id
                join screens sc on sc.id = sh.screen_id
                join theatres t on t.id = sc.theatre_id
                join booking_seats bs on bs.booking_id = b.id
                where u.email = ?
                group by b.id, m.title, sh.show_date, sh.start_time, t.name
                order by b.created_at desc
                """, email);
    }

    /** Full detail for one booking (ticket PDF + confirmation email), scoped to its owner. */
    public Map<String, Object> bookingDetail(String email, long bookingId) {
        return db.queryForMap("""
                select b.id, b.reference, b.status, b.amount, b.created_at, m.title,
                       sh.show_date, sh.start_time, t.name theatre_name, u.email user_email, u.name user_name,
                       string_agg(bs.seat_number, ', ' order by bs.seat_number) seats
                from bookings b
                join users u on u.id = b.user_id
                join shows sh on sh.id = b.show_id
                join movies m on m.id = sh.movie_id
                join screens sc on sc.id = sh.screen_id
                join theatres t on t.id = sc.theatre_id
                join booking_seats bs on bs.booking_id = b.id
                where b.id = ? and u.email = ?
                group by b.id, m.title, sh.show_date, sh.start_time, t.name, u.email, u.name
                """, bookingId, email);
    }

    @Transactional
    public void cancel(String email, long bookingId) {
        int updated = db.update(
                "update bookings b set status='CANCELLED' " +
                        "where b.id=? and b.user_id=(select id from users where email=?) and b.status='CONFIRMED' " +
                        "and (select (sh.show_date + sh.start_time) from shows sh where sh.id=b.show_id) > now()",
                bookingId, email);
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Booking cannot be cancelled (already cancelled, unpaid, or the show has started)");
        }
        // Free the seats so they become bookable by anyone again.
        db.update("update show_seats ss set status='AVAILABLE',locked_by=null,locked_until=null " +
                        "from bookings b join booking_seats bs on bs.booking_id=b.id " +
                        "where b.id=? and ss.show_id=b.show_id and ss.seat_number=bs.seat_number",
                bookingId);
    }

    /** Releases seat holds and bookings whose 10-minute window has lapsed. Runs every minute. */
    @Transactional
    public void expireStaleHolds() {
        db.update("update show_seats set status='AVAILABLE',locked_by=null,locked_until=null " +
                "where status='LOCKED' and locked_until<now()");
        db.update("update bookings set status='EXPIRED' where status='PENDING' and expires_at<now()");
    }
}
