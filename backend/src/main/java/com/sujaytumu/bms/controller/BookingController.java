package com.sujaytumu.bms.controller;

import com.sujaytumu.bms.service.BookingService;
import com.sujaytumu.bms.service.TicketService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/bookings")
public class BookingController {

    private final BookingService bookingService;
    private final TicketService ticketService;

    public BookingController(BookingService bookingService, TicketService ticketService) {
        this.bookingService = bookingService;
        this.ticketService = ticketService;
    }

    @PostMapping("/hold")
    public Map<String, Object> hold(Authentication auth, @RequestBody Map<String, Object> body,
                                    @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        long showId = ((Number) body.get("showId")).longValue();
        @SuppressWarnings("unchecked")
        List<String> seatNumbers = ((List<Object>) body.get("seatNumbers")).stream()
                .map(Object::toString).toList();
        String contactEmail = body.get("contactEmail") == null ? null : body.get("contactEmail").toString();
        String contactPhone = body.get("contactPhone") == null ? null : body.get("contactPhone").toString();
        String couponCode = body.get("couponCode") == null ? null : body.get("couponCode").toString();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> food = body.get("food") instanceof List<?> l ? (List<Map<String, Object>>) l : null;
        // Retry on a database deadlock / lock timeout (rare, and always safe: the whole transaction rolled back).
        for (int attempt = 1; ; attempt++) {
            try {
                return bookingService.holdSeats(auth.getName(), showId, seatNumbers, contactEmail, contactPhone, couponCode, food, idempotencyKey);
            } catch (org.springframework.dao.ConcurrencyFailureException e) {
                if (attempt >= 3) throw e;
                try {
                    Thread.sleep(60L * attempt);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw e;
                }
            }
        }
    }

    @GetMapping("/me")
    public List<Map<String, Object>> myBookings(Authentication auth) {
        return bookingService.myBookings(auth.getName());
    }

    /** One-time +5 minutes on a seat hold that is about to expire. */
    @PostMapping("/{id}/extend-hold")
    public Map<String, Object> extendHold(Authentication auth, @PathVariable long id) {
        return bookingService.extendHold(auth.getName(), id);
    }

    @PostMapping("/{id}/cancel")
    public Map<String, String> cancel(Authentication auth, @PathVariable long id) {
        bookingService.cancel(auth.getName(), id);
        return Map.of("message", "Booking cancelled");
    }

    /** Always available regardless of whether the confirmation email was deliverable. */
    @GetMapping("/{id}/ticket")
    public ResponseEntity<byte[]> ticket(Authentication auth, @PathVariable long id) throws Exception {
        Map<String, Object> detail = bookingService.bookingDetail(auth.getName(), id);
        byte[] pdf = ticketService.generateTicketPdf(detail);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(detail.get("reference") + ".pdf").build().toString())
                .body(pdf);
    }

    @GetMapping("/wallet")
    public Map<String, Object> wallet(Authentication auth) {
        return bookingService.wallet(auth.getName());
    }

    @PostMapping("/wallet/add")
    public Map<String, Object> addMoney(Authentication auth, @RequestBody Map<String, Object> body) {
        Object amt = body.get("amount");
        if (!(amt instanceof Number)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "Enter an amount");
        }
        return bookingService.addMoney(auth.getName(), ((Number) amt).doubleValue());
    }
}
