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
 * This keeps a rolling 10-day window (today through +9) alive indefinitely:
 * for every distinct (movie, screen, start_time, end_time, price) combination
 * that has ever been scheduled, it tops up any missing date in that window.
 * Runs once immediately at startup (so a fresh deploy is correct right away)
 * and then once a day - no redeploy ever required to keep "today" current.
 */
@Component
public class ShowWindowScheduler {

    private static final int WINDOW_DAYS = 10;

    private final JdbcTemplate db;

    public ShowWindowScheduler(JdbcTemplate db) {
        this.db = db;
    }

    @PostConstruct
    public void onStartup() {
        releaseDueMovies();
        applyOneTimeFixes();
        removeClashingShows();
        topUpWindow();
    }

    /** Runs daily at 00:05 server time: new releases first, then the rolling window. */
    @Scheduled(cron = "0 5 0 * * *")
    public void daily() {
        releaseDueMovies();
        applyOneTimeFixes();
        removeClashingShows();
        topUpWindow();
    }

    /**
     * Standard release procedure, fully automatic:
     * 1. A Coming Soon movie whose release_date has arrived becomes Now Showing.
     * 2. Shows already on the calendar are NEVER rewritten (the next 10 days stay exactly as scheduled).
     *    Screens are shared out when a new day is added to the window (see topUpWindow): the newest release
     *    (first 10 days after release) gets every show in single-screen cinemas and 2 of 3 screens in multiplexes.
     */
    public void releaseDueMovies() {
        db.update("""
                update movies set upcoming = false
                where upcoming = true and active = true and release_date is not null
                  and release_date <= (now() at time zone 'Asia/Kolkata')::date
                """);
        assignRatings();
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

    /**
     * One-off clean-up, run exactly once (guarded by app_flags): Sigma and Tella Kagitam leave the listings and their
     * unbooked future shows go to Ranabaali, and Ranabaali gets every show in single-screen cinemas plus 2 of 3
     * screens in multiplexes for the next 10 days. Shows that already have a booking are never touched.
     */
    public void applyOneTimeFixes() {
        int fresh = db.update("insert into app_flags(flag) values('ranabaali_boost_2026_10_19') on conflict do nothing");
        if (fresh == 0) return;
        java.util.List<Long> ids = db.queryForList("select id from movies where title ilike 'Ranabaali' order by id limit 1", Long.class);
        if (ids.isEmpty()) return;
        long ranabaali = ids.get(0);
        db.update("update movies set active = false where lower(title) in ('sigma', 'tella kagitam')");
        String future = "(sh.show_date + sh.start_time) > (now() at time zone 'Asia/Kolkata') "
                + "and not exists (select 1 from bookings b where b.show_id = sh.id and b.status in ('PENDING','CONFIRMED'))";
        db.update("update shows sh set movie_id = ?, language = (select language from movies where id = ?) "
                + "where sh.movie_id in (select id from movies where lower(title) in ('sigma', 'tella kagitam')) and " + future, ranabaali, ranabaali);
        db.update("""
                update shows sh set movie_id = ?, language = (select language from movies where id = ?)
                from (select sc.id screen_id, t.theatre_type,
                             row_number() over (partition by t.id order by sc.id) screen_rank
                      from screens sc join theatres t on t.id = sc.theatre_id where t.active = true) sr
                where sr.screen_id = sh.screen_id and (sr.theatre_type <> 'MULTIPLEX' or sr.screen_rank <= 2)
                  and sh.movie_id <> ? and sh.show_date <= (now() at time zone 'Asia/Kolkata')::date + 9
                  and (select language from movies where id = sh.movie_id) = 'Telugu'
                  and (sh.show_date + sh.start_time) > (now() at time zone 'Asia/Kolkata')
                  and not exists (select 1 from bookings b where b.show_id = sh.id and b.status in ('PENDING','CONFIRMED'))
                """, ranabaali, ranabaali, ranabaali);
    }

    public void topUpWindow() {
        db.update("""
                insert into shows(movie_id,screen_id,show_date,start_time,end_time,price,format,language)
                with slots as (
                    select distinct on (screen_id, start_time) screen_id, start_time, end_time, format, movie_id tmpl
                    from shows order by screen_id, start_time, show_date desc, id desc
                ), scr as (
                    select sc.id screen_id, t.theatre_type,
                           row_number() over (partition by t.id order by sc.id) screen_rank
                    from screens sc join theatres t on t.id = sc.theatre_id where t.active = true
                ), days as (
                    select ((now() at time zone 'Asia/Kolkata')::date + g) d from generate_series(0, ?) g
                ), cand as (
                    select dd.d, m.id, m.release_date,
                           row_number() over (partition by dd.d order by m.release_date desc nulls last, m.id) rk
                    from days dd
                    join movies m on m.active = true and m.language = 'Telugu'
                         and (m.release_date is null or m.release_date <= dd.d)
                         and (m.upcoming = false or m.release_date is not null)
                ), newest as (
                    select d, id from cand where rk = 1 and release_date is not null and d - release_date <= 10
                ), todo as (
                    select s.screen_id, dd.d, s.start_time, s.end_time, s.format, s.tmpl, sr.theatre_type, sr.screen_rank,
                           row_number() over (partition by s.screen_id, dd.d order by s.start_time) slot_idx,
                           (select n.id from newest n where n.d = dd.d) newest_id
                    from slots s join scr sr on sr.screen_id = s.screen_id cross join days dd
                    where not exists (select 1 from shows x where x.screen_id = s.screen_id
                                      and x.show_date = dd.d and x.start_time = s.start_time)
                ), pick as (
                    select td.*,
                           case
                             when td.newest_id is not null and (td.theatre_type <> 'MULTIPLEX' or td.screen_rank <= 2) then td.newest_id
                             when tm.active = true and tm.upcoming = false
                                  and (tm.language <> 'Telugu' or tm.id <> coalesce(td.newest_id, -1)) then tm.id
                             else (select c.id from cand c where c.d = td.d and c.id <> coalesce(td.newest_id, -1)
                                   order by c.rk
                                   offset ((td.slot_idx + td.screen_id) % greatest(
                                       (select count(*) from cand c2 where c2.d = td.d and c2.id <> coalesce(td.newest_id, -1)), 1))
                                   limit 1)
                           end movie_id
                    from todo td left join movies tm on tm.id = td.tmpl
                )
                select p.movie_id, p.screen_id, p.d, p.start_time, p.end_time,
                       case when p.theatre_type = 'MULTIPLEX' then 150 else 100 end, p.format,
                       (select language from movies where id = p.movie_id)
                from pick p
                where p.movie_id is not null
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
