package com.sujaytumu.bms.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/** In-app reminder for confirmed bookings, sent once when the show is within the next 3 hours. */
@Service
public class ShowReminderService {

    private final JdbcTemplate db;

    public ShowReminderService(JdbcTemplate db) {
        this.db = db;
    }

    @Scheduled(initialDelay = 90_000, fixedDelay = 600_000)
    public void sendShowReminders() {
        try {
            remind();
        } catch (Exception e) {
            System.err.println("[show-reminders] failed: " + e.getMessage());
        }
    }

    /** Marks due bookings and writes their notifications in one statement, so a booking is never reminded twice. */
    int remind() {
        return db.update("""
                with due as (
                    update bookings b set show_reminded = true
                    from shows sh
                    where sh.id = b.show_id and b.status = 'CONFIRMED' and b.show_reminded = false and b.created_at < now() - interval '15 minutes'
                      and (sh.show_date + sh.start_time) > (now() at time zone 'Asia/Kolkata')
                      and (sh.show_date + sh.start_time) <= (now() at time zone 'Asia/Kolkata') + interval '3 hours'
                    returning b.user_id, b.reference, sh.movie_id, sh.start_time, sh.screen_id
                )
                insert into user_notifications(user_id, kind, title, body, link)
                select d.user_id, 'reminder',
                       m.title || ' starts at ' || to_char(d.start_time, 'HH12:MI AM'),
                       'Your show at ' || t.name || ' starts soon. Booking ' || d.reference || ' - open your tickets to show the QR at the entrance.',
                       '/bookings'
                from due d
                join movies m on m.id = d.movie_id
                join screens sc on sc.id = d.screen_id
                join theatres t on t.id = sc.theatre_id
                """);
    }
}
