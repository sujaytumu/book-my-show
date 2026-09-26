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
    public Map<String, Object> hold(Authentication auth, @RequestBody Map<String, Object> body) {
        long showId = ((Number) body.get("showId")).longValue();
        @SuppressWarnings("unchecked")
        List<String> seatNumbers = ((List<Object>) body.get("seatNumbers")).stream()
                .map(Object::toString).toList();
        return bookingService.holdSeats(auth.getName(), showId, seatNumbers);
    }

    @GetMapping("/me")
    public List<Map<String, Object>> myBookings(Authentication auth) {
        return bookingService.myBookings(auth.getName());
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
}
