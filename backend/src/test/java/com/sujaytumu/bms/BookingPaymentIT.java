package com.sujaytumu.bms;

import com.sujaytumu.bms.service.BookingService;
import com.sujaytumu.bms.service.PaymentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Regression tests for the money-and-seats paths. They run against a real Postgres (see the backend-tests
 * workflow) because the guarantees rely on row locks and SQL semantics that an in-memory DB would not give.
 */
@SpringBootTest
class BookingPaymentIT {

    @Autowired
    JdbcTemplate db;

    @Autowired
    BookingService bookings;

    long showId;

    @BeforeEach
    void pickShow() {
        showId = db.queryForObject(
                "select sh.id from shows sh where (sh.show_date + sh.start_time) > (now() at time zone 'Asia/Kolkata') " +
                        "and (select count(*) from show_seats ss where ss.show_id=sh.id and ss.status='AVAILABLE') >= 30 " +
                        "order by sh.id desc limit 1", Long.class);
    }

    private String newUser() {
        String email = "it-" + UUID.randomUUID() + "@example.com";
        db.update("insert into users(name,email,password) values(?,?,?)", "IT User", email, "x");
        return email;
    }

    private String freeSeat() {
        List<String> seats = db.queryForList(
                "select seat_number from show_seats where show_id=? and status='AVAILABLE' order by random() limit 1",
                String.class, showId);
        return seats.get(0);
    }

    private long hold(String email, String seat) {
        Map<String, Object> res = bookings.holdSeats(email, showId, List.of(seat), null, null, null, null);
        return ((Number) res.get("bookingId")).longValue();
    }

    private String seatStatus(String seat) {
        return db.queryForObject("select status from show_seats where show_id=? and seat_number=?", String.class, showId, seat);
    }

    private String bookingStatus(long id) {
        return db.queryForObject("select status from bookings where id=?", String.class, id);
    }

    private BigDecimal wallet(String email) {
        return db.queryForObject("select wallet_balance from users where email=?", BigDecimal.class, email);
    }

    /** Simulates SeatExpiryScheduler having released a lapsed hold. */
    private void expire(long bookingId) {
        db.update("update bookings set status='EXPIRED' where id=?", bookingId);
        db.update("update show_seats set status='AVAILABLE',locked_by=null,locked_until=null where locked_by=?", bookingId);
    }

    @Test
    void onlyOneBuyerWinsTheSameSeat() throws Exception {
        String seat = freeSeat();
        int buyers = 8;
        List<String> emails = new ArrayList<>();
        for (int i = 0; i < buyers; i++) emails.add(newUser());

        ExecutorService pool = Executors.newFixedThreadPool(buyers);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Boolean>> results = new ArrayList<>();
        for (String email : emails) {
            Callable<Boolean> task = () -> {
                start.await();
                try {
                    bookings.holdSeats(email, showId, List.of(seat), null, null, null, null);
                    return true;
                } catch (ResponseStatusException e) {
                    return false;
                }
            };
            results.add(pool.submit(task));
        }
        start.countDown();
        int wins = 0;
        for (Future<Boolean> f : results) if (f.get()) wins++;
        pool.shutdown();

        assertEquals(1, wins, "exactly one concurrent buyer may hold a seat");
        assertEquals("LOCKED", seatStatus(seat));
    }

    @Test
    void confirmingTwiceIsHarmless() {
        String email = newUser();
        String seat = freeSeat();
        long id = hold(email, seat);

        assertTrue(bookings.confirmBooking(id, "pay_1"));
        assertFalse(bookings.confirmBooking(id, "pay_1"), "a duplicate confirmation must be a no-op");
        assertEquals("CONFIRMED", bookingStatus(id));
        assertEquals("BOOKED", seatStatus(seat));
    }

    @Test
    void latePaymentIsRefundedWhenTheSeatWasTakenMeanwhile() {
        String a = newUser();
        String b = newUser();
        String seat = freeSeat();
        long bookingA = hold(a, seat);
        expire(bookingA);
        long bookingB = hold(b, seat);
        assertTrue(bookings.confirmBooking(bookingB, "pay_b"));

        BigDecimal before = wallet(a);
        assertEquals("REFUNDED", bookings.settleLatePayment(bookingA, "pay_a"));

        BigDecimal amount = db.queryForObject("select amount from bookings where id=?", BigDecimal.class, bookingA);
        assertEquals(0, before.add(amount).compareTo(wallet(a)), "the full amount goes back to the wallet");
        assertEquals("BOOKED", seatStatus(seat), "the other buyer keeps the seat");
        assertEquals("REFUNDED", bookingStatus(bookingA));
        // a second delivery of the same late payment must not refund again
        assertEquals("IGNORED", bookings.settleLatePayment(bookingA, "pay_a"));
        assertEquals(0, before.add(amount).compareTo(wallet(a)));
    }

    @Test
    void latePaymentIsHonouredWhenTheSeatIsStillFree() {
        String a = newUser();
        String seat = freeSeat();
        long bookingA = hold(a, seat);
        expire(bookingA);

        assertEquals("CONFIRMED", bookings.settleLatePayment(bookingA, "pay_a"));
        assertEquals("CONFIRMED", bookingStatus(bookingA));
        assertEquals("BOOKED", seatStatus(seat));
    }

    @Test
    void webhookConfirmsOnceAndRejectsBadSignatures() throws Exception {
        PaymentService payments = new PaymentService(db, "key", "secret", "whsec");
        String email = newUser();
        String seat = freeSeat();
        long id = hold(email, seat);
        String order = "order_" + UUID.randomUUID().toString().substring(0, 8);
        db.update("update bookings set razorpay_order_id=? where id=?", order, id);

        String body = "{\"event\":\"payment.captured\",\"created_at\":1,\"payload\":{\"payment\":{\"entity\":{\"id\":\"pay_w1\",\"order_id\":\""
                + order + "\"}}}}";
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec("whsec".getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        String signature = HexFormat.of().formatHex(mac.doFinal(body.getBytes(StandardCharsets.UTF_8)));
        String eventId = "evt_" + UUID.randomUUID();

        assertThrows(ResponseStatusException.class, () -> payments.handleWebhook(body, "bad-signature", eventId, bookings));
        assertEquals("PENDING", bookingStatus(id));

        assertEquals("ok", payments.handleWebhook(body, signature, eventId, bookings));
        assertEquals("CONFIRMED", bookingStatus(id));
        assertEquals("BOOKED", seatStatus(seat));

        assertEquals("duplicate", payments.handleWebhook(body, signature, eventId, bookings));
    }
}
