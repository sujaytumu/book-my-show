package com.sujaytumu.bms.scheduler;

import jakarta.annotation.PostConstruct;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Show dates are seeded once at boot (relative to that boot's "today"), so
 * without this, the browsable window would just sit fixed at whatever dates
 * existed at the last deploy - drifting into the past and never reaching
 * further into the future as real time moves on.
 *
 * This keeps a rolling 7-day window (today through +6) alive indefinitely:
 * for every distinct (movie, screen, start_time, end_time, price) combination
 * that has ever been scheduled, it tops up any missing date in that window.
 * Runs once immediately at startup (so a fresh deploy is correct right away)
 * and then once a day - no redeploy ever required to keep "today" current.
 */
@Component
public class ShowWindowScheduler {

    private static final int WINDOW_DAYS = 7;

    private final JdbcTemplate db;

    public ShowWindowScheduler(JdbcTemplate db) {
        this.db = db;
    }

    @PostConstruct
    public void onStartup() {
        topUpWindow();
    }

    /** Runs daily at 00:05 server time. */
    @Scheduled(cron = "0 5 0 * * *")
    public void topUpWindow() {
        db.update("""
                insert into shows(movie_id,screen_id,show_date,start_time,end_time,price)
                select r.movie_id, r.screen_id, current_date + d.day_offset, r.start_time, r.end_time, r.price
                from (select distinct movie_id, screen_id, start_time, end_time, price from shows) r
                join movies m on m.id = r.movie_id
                join screens sc on sc.id = r.screen_id
                join theatres t on t.id = sc.theatre_id
                cross join generate_series(0, ?) as d(day_offset)
                where m.active = true and m.upcoming = false and t.active = true
                and not exists (
                    select 1 from shows sh2
                    where sh2.movie_id = r.movie_id and sh2.screen_id = r.screen_id
                      and sh2.show_date = current_date + d.day_offset and sh2.start_time = r.start_time
                )
                """, WINDOW_DAYS - 1);
    }
}
