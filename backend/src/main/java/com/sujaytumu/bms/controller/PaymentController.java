package com.sujaytumu.bms.controller;

import com.sujaytumu.bms.service.BookingService;
import com.sujaytumu.bms.service.EmailService;
import com.sujaytumu.bms.service.PaymentService;
import com.sujaytumu.bms.service.TicketService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    private final PaymentService paymentService;
    private final BookingService bookingService;
    private final TicketService ticketService;
    private final EmailService emailService;

    public PaymentController(PaymentService paymentService, BookingService bookingService,
                              TicketService ticketService, EmailService emailService) {
        this.paymentService = paymentService;
        this.bookingService = bookingService;
        this.ticketService = ticketService;
        this.emailService = emailService;
    }

    /**
     * Tells the frontend which checkout flow to run. Returns "razorpay" once
     * RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET are configured; until then the
     * frontend falls back to the mock flow below so v1 works end-to-end
     * without a live payment-gateway account.
     */
    @GetMapping("/mode")
    public Map<String, Object> mode() {
        return paymentService.isConfigured()
                ? Map.of("mode", "razorpay")
                : Map.of("mode", "mock");
    }

    @PostMapping("/create-order/{bookingId}")
    public Map<String, Object> createOrder(Authentication auth, @PathVariable long bookingId) throws Exception {
        Map<String, Object> booking = bookingService.bookingForPayment(auth.getName(), bookingId);
        double amount = ((Number) booking.get("amount")).doubleValue();
        String reference = (String) booking.get("reference");
        return paymentService.createOrder(bookingId, amount, reference);
    }

    /** Mock checkout used when no Razorpay keys are configured: confirms the booking directly. */
    @PostMapping("/mock-confirm/{bookingId}")
    public Map<String, String> mockConfirm(Authentication auth, @PathVariable long bookingId) {
        bookingService.bookingForPayment(auth.getName(), bookingId); // 403s if this booking isn't theirs
        if (!bookingService.holdStillValid(bookingId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Seat hold expired");
        }
        bookingService.confirmBooking(bookingId, "MOCK-" + java.util.UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        emailTicket(auth.getName(), bookingId);
        return Map.of("status", "success");
    }

    @PostMapping("/verify")
    public Map<String, String> verify(Authentication auth, @RequestBody Map<String, String> body) throws Exception {
        String orderId = body.get("razorpayOrderId");
        String paymentId = body.get("razorpayPaymentId");
        String signature = body.get("razorpaySignature");

        Map<String, Object> booking = bookingService.bookingByOrderId(auth.getName(), orderId);

        if (!paymentService.verifySignature(orderId, paymentId, signature)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid payment signature");
        }

        long bookingId = ((Number) booking.get("id")).longValue();
        if (!bookingService.holdStillValid(bookingId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Seat hold expired");
        }

        bookingService.confirmBooking(bookingId, paymentId);
        paymentService.markPaid(orderId, paymentId);
        emailTicket(auth.getName(), bookingId);
        return Map.of("status", "success");
    }

    /** Best-effort: a failed/unset email integration never fails the booking itself. */
    private void emailTicket(String email, long bookingId) {
        try {
            Map<String, Object> detail = bookingService.bookingDetail(email, bookingId);
            byte[] pdf = ticketService.generateTicketPdf(detail);
            String html = "<p>Hi " + detail.get("user_name") + ",</p>" +
                    "<p>Your booking for <b>" + detail.get("title") + "</b> is confirmed.</p>" +
                    "<p>Reference: <b>" + detail.get("reference") + "</b><br>" +
                    "Seats: " + detail.get("seats") + "<br>" +
                    detail.get("show_date") + " at " + detail.get("start_time") + "</p>" +
                    "<p>Your ticket is attached as a PDF.</p>";
            emailService.sendTicket((String) detail.get("user_email"), (String) detail.get("user_name"),
                    "Your Book My Show ticket - " + detail.get("reference"), html, pdf,
                    detail.get("reference") + ".pdf");
        } catch (Exception e) {
            System.err.println("Could not email ticket for booking " + bookingId + ": " + e.getMessage());
        }
    }
}
