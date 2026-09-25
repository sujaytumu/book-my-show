package com.sujaytumu.bms.scheduler;

import com.sujaytumu.bms.service.BookingService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class SeatExpiryScheduler {

    private final BookingService bookingService;

    public SeatExpiryScheduler(BookingService bookingService) {
        this.bookingService = bookingService;
    }

    /** Every 60s: flip lapsed LOCKED seats back to AVAILABLE and PENDING bookings to EXPIRED. */
    @Scheduled(fixedDelay = 60000)
    public void releaseExpiredHolds() {
        bookingService.expireStaleHolds();
    }
}
