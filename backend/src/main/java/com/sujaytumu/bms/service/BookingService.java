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
    public Map<String, Object> holdSeats(String email, long showId, List<String> rawSeatNumbers,
                                          String contactEmail, String contactPhone, String couponCode,
                                          List<Map<String, Object>> food) {
        List<String> seatNumbers = rawSeatNumbers.stream().distinct().toList();
        if (seatNumbers.isEmpty() || seatNumbers.size() > MAX_SEATS_PER_BOOKING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Select between 1 and " + MAX_SEATS_PER_BOOKING + " seats");
        }

        List<Boolean> showStarted = db.queryForList(
                "select (show_date + start_time) <= (now() at time zone 'Asia/Kolkata') from shows where id=?",
                Boolean.class, showId);
        if (showStarted.contains(Boolean.TRUE)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "This show has already started - booking is closed");
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

        Map<String, Object> user = db.queryForMap("select id,name,email from users where email=?", email);
        long userId = ((Number) user.get("id")).longValue();
        String theatreType = db.queryForObject(
                "select t.theatre_type from shows sh join screens sc on sc.id=sh.screen_id " +
                        "join theatres t on t.id=sc.theatre_id where sh.id=?", String.class, showId);

        // Real ticketing platforms charge the seat price plus a convenience fee, with
        // GST applied to that fee (not to the ticket price itself, which already has
        // any entertainment tax baked in by the cinema). 3% is a representative rate.
        // Seat price depends on the seat's class (row) and the theatre type - see Pricing.
        double subtotal = 0;
        for (String seatNumber : seatNumbers) subtotal += Pricing.seatPrice(theatreType, seatNumber);
        subtotal = round2(subtotal);
        // Optional coupon: a percentage off the ticket price only. The convenience fee and GST stay on the full price.
        String appliedCoupon = null;
        double discount = 0;
        if (couponCode != null && !couponCode.isBlank()) {
            List<Map<String, Object>> found = db.queryForList(
                    "select * from coupons where upper(code)=upper(?) and active=true", couponCode.trim());
            if (found.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This coupon code is not valid");
            }
            Map<String, Object> coupon = found.get(0);
            double minAmount = ((Number) coupon.get("min_amount")).doubleValue();
            if (subtotal < minAmount) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Add Rs " + Math.round(minAmount - subtotal) + " more in tickets to use " + coupon.get("code"));
            }
            if (Boolean.TRUE.equals(coupon.get("first_booking_only"))) {
                Long earlier = db.queryForObject(
                        "select count(*) from bookings where user_id=? and status='CONFIRMED'", Long.class, userId);
                if (earlier != null && earlier > 0) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            coupon.get("code") + " is only valid on your first booking");
                }
            }
            double percent = ((Number) coupon.get("percent")).doubleValue();
            double cap = ((Number) coupon.get("max_discount")).doubleValue();
            discount = Math.min(Math.min(round2(subtotal * percent / 100.0), cap), subtotal);
            appliedCoupon = (String) coupon.get("code");
        }
        double convenienceFee = round2(subtotal * 0.03);
        double gst = round2(convenienceFee * 0.18);
        // Optional snacks: priced from the food_items table (never trusted from the client); no fee/GST added.
        double foodTotal = 0;
        List<String> foodLines = new java.util.ArrayList<>();
        if (food != null) {
            for (Map<String, Object> line : food) {
                if (line.get("id") == null || line.get("qty") == null) continue;
                int qty = Math.min(((Number) line.get("qty")).intValue(), 20);
                if (qty <= 0) continue;
                List<Map<String, Object>> item = db.queryForList(
                        "select name, price from food_items where id=? and active=true",
                        ((Number) line.get("id")).longValue());
                if (item.isEmpty()) continue;
                foodTotal += ((Number) item.get(0).get("price")).doubleValue() * qty;
                foodLines.add(qty + " x " + item.get(0).get("name"));
            }
        }
        foodTotal = round2(foodTotal);
        String foodSummary = foodLines.isEmpty() ? null : String.join(", ", foodLines);
        double total = round2(subtotal - discount + convenienceFee + gst + foodTotal);

        String finalContactEmail = (contactEmail == null || contactEmail.isBlank())
                ? (String) user.get("email") : contactEmail.trim();
        String finalContactPhone = (contactPhone == null || contactPhone.isBlank()) ? null : contactPhone.trim();

        Instant expiresAt = now.plusSeconds(HOLD_SECONDS);
        String reference = "BMS-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        long bookingId = db.queryForObject(
                "insert into bookings(user_id,show_id,reference,status,amount,ticket_subtotal,convenience_fee," +
                        "gst_amount,contact_email,contact_phone,expires_at,coupon_code,discount_amount,food_amount,food_summary) " +
                        "values(?,?,?,'PENDING',?,?,?,?,?,?,?,?,?,?,?) returning id",
                Long.class, userId, showId, reference, total, subtotal, convenienceFee, gst,
                finalContactEmail, finalContactPhone, Timestamp.from(expiresAt), appliedCoupon, discount, foodTotal, foodSummary);

        for (String seatNumber : seatNumbers) {
            db.update("insert into booking_seats(booking_id,seat_number) values(?,?)", bookingId, seatNumber);
            db.update("update show_seats set status='LOCKED',locked_by=?,locked_until=? where show_id=? and seat_number=?",
                    bookingId, Timestamp.from(expiresAt), showId, seatNumber);
        }

        Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("bookingId", bookingId);
        result.put("reference", reference);
        result.put("ticketSubtotal", subtotal);
        result.put("discount", discount);
        result.put("foodAmount", foodTotal);
        if (foodSummary != null) result.put("foodSummary", foodSummary);
        if (appliedCoupon != null) result.put("couponCode", appliedCoupon);
        result.put("convenienceFee", convenienceFee);
        result.put("gst", gst);
        result.put("amount", total);
        result.put("expiresAt", expiresAt.toString());
        result.put("seats", seatNumbers);
        return result;
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
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

    /** Pays a pending booking from the wallet: debit (only if funds suffice) and confirm in one transaction. */
    @Transactional
    public void payWithWallet(String email, long bookingId) {
        Map<String, Object> booking = bookingForPayment(email, bookingId);
        if (!holdStillValid(bookingId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Seat hold expired");
        }
        long userId = ((Number) booking.get("user_id")).longValue();
        double amount = ((Number) booking.get("amount")).doubleValue();
        int debited = db.update(
                "update users set wallet_balance = wallet_balance - ? where id=? and wallet_balance >= ?",
                amount, userId, amount);
        if (debited == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Not enough wallet balance - add money first");
        }
        db.update("insert into wallet_txns(user_id,amount,kind,note) values(?,?,'PAYMENT',?)",
                userId, -amount, "Booking " + booking.get("reference"));
        confirmBooking(bookingId, "WALLET-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
    }

    public Map<String, Object> wallet(String email) {
        Map<String, Object> user = db.queryForMap("select id, wallet_balance from users where email=?", email);
        List<Map<String, Object>> txns = db.queryForList(
                "select amount, kind, note, created_at from wallet_txns where user_id=? order by created_at desc, id desc limit 20",
                user.get("id"));
        Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("balance", user.get("wallet_balance"));
        out.put("transactions", txns);
        return out;
    }

    /** Demo top-up (no real payment gateway involved). */
    @Transactional
    public Map<String, Object> addMoney(String email, double amount) {
        if (amount < 1 || amount > 10000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter an amount between Rs 1 and Rs 10,000");
        }
        amount = round2(amount);
        long userId = db.queryForObject("select id from users where email=?", Long.class, email);
        db.update("update users set wallet_balance = wallet_balance + ? where id=?", amount, userId);
        db.update("insert into wallet_txns(user_id,amount,kind,note) values(?,?,'TOPUP','Money added (demo)')", userId, amount);
        return wallet(email);
    }

    public List<Map<String, Object>> myBookings(String email) {
        return db.queryForList("""
                select b.id, b.reference, b.status, b.amount, b.created_at, m.title,
                       sh.show_date, sh.start_time, t.name theatre_name, t.cancellable, b.food_summary,
                       string_agg(bs.seat_number, ', ' order by bs.seat_number) seats
                from bookings b
                join users u on u.id = b.user_id
                join shows sh on sh.id = b.show_id
                join movies m on m.id = sh.movie_id
                join screens sc on sc.id = sh.screen_id
                join theatres t on t.id = sc.theatre_id
                join booking_seats bs on bs.booking_id = b.id
                where u.email = ?
                group by b.id, m.title, sh.show_date, sh.start_time, t.name, t.cancellable
                order by b.created_at desc
                """, email);
    }

    /** Full detail for one booking (ticket PDF + confirmation email), scoped to its owner. */
    public Map<String, Object> bookingDetail(String email, long bookingId) {
        return db.queryForMap("""
                select b.id, b.reference, b.status, b.amount, b.ticket_subtotal, b.convenience_fee, b.gst_amount,
                       b.coupon_code, b.discount_amount, b.contact_email, b.contact_phone, b.created_at, m.title,
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
    @Transactional
    public void cancel(String email, long bookingId) {
        int updated = db.update(
                "update bookings b set status='CANCELLED' " +
                        "where b.id=? and b.user_id=(select id from users where email=?) and b.status='CONFIRMED' " +
                        "and (select (sh.show_date + sh.start_time) from shows sh where sh.id=b.show_id) > now() " +
                        "and (select t.cancellable from shows sh join screens sc on sc.id=sh.screen_id join theatres t on t.id=sc.theatre_id where sh.id=b.show_id)",
                bookingId, email);
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Booking cannot be cancelled (already cancelled, unpaid, the show has started, or this cinema does not allow cancellation)");
        }
        // Refund the full amount to the wallet.
        Map<String, Object> paid = db.queryForMap(
                "select user_id, amount, reference from bookings where id=?", bookingId);
        db.update("update users set wallet_balance = wallet_balance + ? where id=?", paid.get("amount"), paid.get("user_id"));
        db.update("insert into wallet_txns(user_id,amount,kind,note) values(?,?,'REFUND',?)",
                paid.get("user_id"), paid.get("amount"), "Refund for " + paid.get("reference"));
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
