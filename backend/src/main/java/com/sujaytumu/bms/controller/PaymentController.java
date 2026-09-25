package com.sujaytumu.bms.controller;

import com.sujaytumu.bms.service.BookingService;
import com.sujaytumu.bms.service.PaymentService;
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

    public PaymentController(PaymentService paymentService, BookingService bookingService) {
        this.paymentService = paymentService;
        this.bookingService = bookingService;
    }

    @PostMapping("/create-order/{bookingId}")
    public Map<String, Object> createOrder(Authentication auth, @PathVariable long bookingId) throws Exception {
        Map<String, Object> booking = bookingService.bookingForPayment(auth.getName(), bookingId);
        double amount = ((Number) booking.get("amount")).doubleValue();
        String reference = (String) booking.get("reference");
        return paymentService.createOrder(bookingId, amount, reference);
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
        return Map.of("status", "success");
    }
}
