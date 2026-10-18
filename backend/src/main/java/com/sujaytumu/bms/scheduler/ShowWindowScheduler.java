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
        releaseDueMovies();
        removeClashingShows();
        topUpWindow();
    }

    /** Runs daily at 00:05 server time: new releases first, then the rolling window. */
    @Scheduled(cron = "0 5 0 * * *")
    public void daily() {
        releaseDueMovies();
        removeClashingShows();
        topUpWindow();
    }

    /**
     * Standard release procedure, fully automatic:
     * 1. A Coming Soon movie whose release_date has arrived becomes Now Showing.
     * 2. A newly released movie takes most of the screens: about 2/3 of the screens in every
     *    multiplex and 3 of 4 shows in a single screen. The shows taken over are the oldest
     *    movies' shows first, but every old movie keeps at least one show per cinema per day,
     *    so a couple of older films lose most screens and keep a few.
     * Shows that already have a booking are never touched.
     */
    public void releaseDueMovies() {
        db.update("""
                update movies set upcoming = false
                where upcoming = true and active = true and release_date is not null
                  and release_date <= (now() at time zone 'Asia/Kolkata')::date
                """);
        assignRatings();
        java.util.List<Long> fresh = db.queryForList("""
                select id from movies
                where active = true and upcoming = false and release_date is not null
                  and release_date between (now() at time zone 'Asia/Kolkata')::date - 14
                                       and (now() at time zone 'Asia/Kolkata')::date
                  and not exists (select 1 from shows sh where sh.movie_id = movies.id
                                  and sh.show_date >= (now() at time zone 'Asia/Kolkata')::date)
                order by release_date, id
                """, Long.class);
        for (Long movieId : fresh) {
            db.update("""
                    with base as (
                        select sh.id, t.id theatre_id, sh.show_date, sh.start_time, sh.movie_id, t.theatre_type,
                               coalesce(m.release_date, date '1900-01-01') rel,
                               exists(select 1 from bookings b where b.show_id = sh.id
                                      and b.status in ('PENDING','CONFIRMED')) booked
                        from shows sh
                        join screens sc on sc.id = sh.screen_id
                        join theatres t on t.id = sc.theatre_id
                        join movies m on m.id = sh.movie_id
                        where t.active = true
                          and sh.show_date >= (now() at time zone 'Asia/Kolkata')::date
                          and m.language = (select language from movies where id = ?)
                    ), sized as (
                        select base.*, count(*) over (partition by theatre_id, show_date) n,
                               row_number() over (partition by theatre_id, show_date, movie_id order by start_time) rn_movie
                        from base
                    ), ranked as (
                        select sized.*, row_number() over (partition by theatre_id, show_date order by rel, movie_id, start_time) pos
                        from sized
                        where movie_id <> ? and not booked and rn_movie > 1
                    )
                    update shows s set movie_id = ?, language = (select language from movies where id = ?)
                    from ranked r
                    where s.id = r.id
                      and r.pos <= ceil(r.n * case when r.theatre_type = 'MULTIPLEX' then 2.0 / 3 else 0.75 end)
                    """, movieId, movieId, movieId, movieId);
        }
    }

    /**
     * Every Now Showing movie gets a rating and a votes figure automatically (random, assigned once and then kept),
     * and every movie gets an "interested" figure, so nothing shows 0.0 or an empty count.
     */
    public void assignRatings() {
        db.update("update movies set rating = round((6.8 + random() * 2.4)::numeric, 1) "
                + "where upcoming = false and active = true and (rating is null or rating = 0)");
        db.update("update movies set votes_base = 800 + floor(random() * 60000)::int "
                + "where upcoming = false and active = true and votes_base is null");
        db.update("update movies set interested_base = 5000 + floor(random() * 400000)::int where interested_base is null");
    }

    /**
     * A screen can only play one film at a time: where older data put two films on the same
     * screen at the same time, keep the more recent release and drop the other (future, unbooked shows only).
     */
    public void removeClashingShows() {
        db.update("""
                delete from shows where id in (
                    select id from (
                        select sh.id,
                               row_number() over (partition by sh.screen_id, sh.show_date, sh.start_time
                                                  order by coalesce(m.release_date, date '1900-01-01') desc, sh.id) rn,
                               exists(select 1 from bookings b where b.show_id = sh.id
                                      and b.status in ('PENDING','CONFIRMED')) booked
                        from shows sh join movies m on m.id = sh.movie_id
                        where sh.show_date >= (now() at time zone 'Asia/Kolkata')::date
                    ) x where rn > 1 and not booked
                )
                """);
    }

    public void topUpWindow() {
        db.update("""
                insert into shows(movie_id,screen_id,show_date,start_time,end_time,price,format,language)
                select r.movie_id, r.screen_id, (now() at time zone 'Asia/Kolkata')::date + d.day_offset, r.start_time, r.end_time,
                       case when t.theatre_type = 'MULTIPLEX' then 150 else 100 end, r.format, r.language
                from (select distinct on (screen_id, start_time) movie_id, screen_id, start_time, end_time, price, format, language
                      from shows order by screen_id, start_time, show_date desc, id desc) r
                join movies m on m.id = r.movie_id
                join screens sc on sc.id = r.screen_id
                join theatres t on t.id = sc.theatre_id
                cross join generate_series(0, ?) as d(day_offset)
                where m.active = true and m.upcoming = false and t.active = true
                and not exists (
                    select 1 from shows sh2
                    where sh2.screen_id = r.screen_id
                      and sh2.show_date = (now() at time zone 'Asia/Kolkata')::date + d.day_offset and sh2.start_time = r.start_time
                )
                """, WINDOW_DAYS - 1);

        // New shows need their seats too (10 rows A-J x 15 seats).
        db.update("""
                insert into show_seats(show_id,seat_number,seat_type)
                select sh.id, chr(65 + r) || n::text, case when r < 4 then 'PREMIUM' else 'REGULAR' end
                from shows sh cross join generate_series(0,9) r cross join generate_series(1,15) n
                where (select count(*) from show_seats ss where ss.show_id = sh.id) < 150
                on conflict (show_id,seat_number) do nothing
                """);
    }
}
