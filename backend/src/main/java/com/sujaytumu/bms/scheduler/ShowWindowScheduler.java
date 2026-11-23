package com.sujaytumu.bms.scheduler;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
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

    /**
     * Advance booking: a Coming Soon movie gets screens (from its release date on, taken from the existing movies in the
     * usual weighted balance) only once its release is this many days away or closer. Further out it has no screens, so the
     * app shows no showtimes and no Book tickets button for it.
     */
    public static final int ADVANCE_BOOKING_DAYS = 3;

    public ShowWindowScheduler(JdbcTemplate db) {
        this.db = db;
    }

    /**
     * Runs once the server is already up and answering requests, in the background. This used to run before the web
     * server opened its port, so every wake-up from sleep waited for all of this (several heavy queries on a remote
     * database) and the app looked dead for minutes.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        Thread t = new Thread(() -> {
            try {
                // Let the first visitors' requests go first: the free instance has very little CPU.
                Thread.sleep(25_000);
                runAll();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } catch (RuntimeException e) {
                org.slf4j.LoggerFactory.getLogger(ShowWindowScheduler.class).error("Startup show scheduling failed", e);
            }
        }, "show-window-startup");
        t.setDaemon(true);
        t.start();
    }

    /** Runs daily at 00:05 server time: new releases first, then the rolling window. */
    @Scheduled(cron = "0 5 0 * * *")
    public void daily() {
        runAll();
    }

    private synchronized void runAll() {
        step("purgePastSeats", this::purgePastSeats);
        step("releaseDueMovies", this::releaseDueMovies);
        step("applyOneTimeFixes", this::applyOneTimeFixes);
        step("retireCult", this::retireCult);
        step("removeClashingShows", this::removeClashingShows);
        step("topUpWindow", this::topUpWindow);
        step("assignScreensByRatio", this::assignScreensByRatio);
        step("applyReleaseVariants", this::applyReleaseVariants);
        step("forceTwoD", this::forceTwoD);
    }

    /** Runs one job and logs how long it took (visible in the Render logs); one failing job no longer stops the others. */
    private void step(String name, Runnable job) {
        long t0 = System.currentTimeMillis();
        try {
            job.run();
            org.slf4j.LoggerFactory.getLogger(ShowWindowScheduler.class).info("show-window {} took {} ms", name, System.currentTimeMillis() - t0);
        } catch (RuntimeException e) {
            org.slf4j.LoggerFactory.getLogger(ShowWindowScheduler.class).error("show-window {} failed", name, e);
        }
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
                      and (sh.language is null or sh.language = 'Telugu')
                  and (sh.show_date + sh.start_time) > (now() at time zone 'Asia/Kolkata')
                  and not exists (select 1 from bookings b where b.show_id = sh.id and b.status in ('PENDING','CONFIRMED'))
                """, ranabaali, ranabaali, ranabaali);
    }

    /** One-off (guarded by app_flags): Cult leaves the listings. It had no bookings, so nothing else is touched. */
    public void retireCult() {
        int fresh = db.update("insert into app_flags(flag) values('cult_removed_2026_11_15') on conflict do nothing");
        if (fresh == 0) return;
        db.update("update movies set active = false where lower(title) = 'cult'");
    }

    /**
     * Gives every screen one film at a time, shared out between the running movies by how new they are. For every day
     * of the next 10 days:
     *  - A single-screen cinema plays ONE film in all its shows.
     *  - A multiplex screen plays one film in all its shows too; a screen that lists many shows (12 or more on one hall
     *    in the data) is split into "lanes" of about 4 shows, each lane one film, so the same film always comes back
     *    about every 3 hours. A film that is in a multiplex therefore has its timings spread over the whole day, and a
     *    film that is not in that multiplex has none.
     *  - The number of screens a movie gets follows its weight 100 / (2 + days since release)^1.3 (never below 2): the
     *    newest release has by far the most screens (about 41 / 24 / 16 / 12 for day 0 / 1 / 2 / 3), older ones fewer, in order. Screens are taken in a fixed pseudo-random order
     *    so the share is exact and every area of the city gets every film.
     * Only unbooked shows are touched: a show with a pending or confirmed booking, a held or booked seat, or starting
     * within 3 hours keeps its film, and the rest of that screen follows it. Nothing is deleted.
     */
    public void assignScreensByRatio() {
        db.update("""
                with ist as (select (now() at time zone 'Asia/Kolkata') t),
                base as (
                    select sh.id show_id, sh.show_date d, sh.screen_id, sh.start_time, sh.movie_id, t.theatre_type tt,
                           m.language mlang, m.active mactive,
                           ((sh.show_date + sh.start_time) > (select t from ist) + interval '3 hours'
                            and not exists (select 1 from bookings b where b.show_id = sh.id and b.status in ('PENDING','CONFIRMED'))
                            and not exists (select 1 from show_seats ss where ss.show_id = sh.id and ss.status <> 'AVAILABLE')) free
                    from shows sh
                    join screens sc on sc.id = sh.screen_id
                    join theatres t on t.id = sc.theatre_id and t.active = true
                    join movies m on m.id = sh.movie_id
                    where sh.show_date between (select t from ist)::date and (select t from ist)::date + 9
                ), numbered as (
                    select b.*, count(*) over (partition by screen_id, d) n,
                           row_number() over (partition by screen_id, d order by start_time, show_id) rn
                    from base b
                ), laned as (
                    select n.*, case when tt = 'MULTIPLEX' then (rn - 1) % greatest(1, round(n / 4.0)::int) else 0 end lane
                    from numbered n
                ), units as (
                    select d, screen_id, lane,
                           (array_agg(movie_id order by start_time desc) filter (where not free and mactive and mlang = 'Telugu'))[1] forced
                    from laned group by d, screen_id, lane
                ), ranked_units as (
                    select u.*, count(*) over (partition by d) tot_units,
                           row_number() over (partition by d order by (screen_id * 3 + lane) * 0.6180339887 - floor((screen_id * 3 + lane) * 0.6180339887), screen_id, lane) ur
                    from units u
                ), days as (
                    select distinct d from units
                ), cm as (
                    select dd.d, m.id,
                           greatest(2.0, 100.0 / power(2 + greatest(0, dd.d - coalesce(m.release_date, dd.d - 60)), 1.3)) wt,
                           m.release_date
                    from days dd
                    join movies m on m.active = true and m.language = 'Telugu'
                         and (m.release_date is null or m.release_date <= dd.d)
                         and (m.upcoming = false or (m.release_date is not null and m.release_date <= (now() at time zone 'Asia/Kolkata')::date + @ADV@))
                ), ranked as (
                    select d, id, wt,
                           sum(wt) over (partition by d) tot,
                           sum(wt) over (partition by d order by wt desc, release_date desc nulls last, id
                                         rows between unbounded preceding and current row) cum_end
                    from cm
                ), pick as (
                    select u.d, u.screen_id, u.lane, coalesce(u.forced, r.id) movie_id
                    from ranked_units u
                    left join ranked r on r.d = u.d
                         and ((u.ur - 0.5) / u.tot_units) * r.tot >= r.cum_end - r.wt
                         and ((u.ur - 0.5) / u.tot_units) * r.tot < r.cum_end
                )
                update shows sh set movie_id = p.movie_id, language = (select language from movies where id = p.movie_id)
                from laned l join pick p on p.d = l.d and p.screen_id = l.screen_id and p.lane = l.lane
                where sh.id = l.show_id and l.free and l.mlang = 'Telugu'
                  and p.movie_id is not null and sh.movie_id <> p.movie_id
                """.replace("@ADV@", String.valueOf(ADVANCE_BOOKING_DAYS)));
    }

    /**
     * Every film except Ramayana plays in plain 2D only (3D, IMAX, Dolby, 4DX and PXL are for the films flagged
     * multi_format, which is Ramayana). Unbooked shows only, so a ticket that was already bought keeps its format.
     */
    public void forceTwoD() {
        db.update("""
                update shows sh set format = '2D'
                from movies m
                where m.id = sh.movie_id and m.multi_format = false and sh.format is distinct from '2D'
                  and sh.show_date >= (now() at time zone 'Asia/Kolkata')::date
                  and not exists (select 1 from bookings b where b.show_id = sh.id and b.status in ('PENDING','CONFIRMED'))
                  and not exists (select 1 from show_seats ss where ss.show_id = sh.id and ss.status <> 'AVAILABLE')
                """);
    }

    /**
     * Gives every release its languages and formats: the languages listed in movies.show_languages (just its own language when
     * empty) and 2D, 3D, IMAX, Dolby, 4DX, PXL, as ReleaseVariants decides per show. Only the next 10 days, only
     * shows with no pending or confirmed booking and no held seat, and none starting within 3 hours. Nothing is deleted.
     */
    public void applyReleaseVariants() {
        var rows = db.queryForList("""
                select sh.id, sh.start_time, sh.language, sh.format, t.name theatre, t.theatre_type, c.name city,
                       m.language movie_language, m.show_languages, m.multi_format
                from shows sh
                join movies m on m.id = sh.movie_id
                join screens sc on sc.id = sh.screen_id
                join theatres t on t.id = sc.theatre_id and t.active = true
                join cities c on c.id = t.city_id
                where sh.show_date between (now() at time zone 'Asia/Kolkata')::date and (now() at time zone 'Asia/Kolkata')::date + 9
                  and (sh.show_date + sh.start_time) > (now() at time zone 'Asia/Kolkata') + interval '3 hours'
                  and (sh.language is null or sh.language = m.language)
                  and not exists (select 1 from bookings b where b.show_id = sh.id and b.status in ('PENDING','CONFIRMED'))
                  and not exists (select 1 from show_seats ss where ss.show_id = sh.id and ss.status <> 'AVAILABLE')
                """);
        java.util.List<Object[]> updates = new java.util.ArrayList<>();
        for (var r : rows) {
            long id = ((Number) r.get("id")).longValue();
            String langs = (String) r.get("show_languages");
            java.util.List<String> allowed = langs == null || langs.isBlank() ? java.util.List.of()
                    : java.util.Arrays.stream(langs.split("[,/&]")).map(String::trim).filter(x -> !x.isEmpty()).toList();
            var label = com.sujaytumu.bms.service.ReleaseVariants.label(id, (String) r.get("city"), (String) r.get("theatre"),
                    (String) r.get("theatre_type"), ((java.sql.Time) r.get("start_time")).toLocalTime(),
                    allowed, (String) r.get("movie_language"));
            String fmt = Boolean.TRUE.equals(r.get("multi_format")) ? label.format() : "2D";
            if (!label.language().equals(r.get("language")) || !fmt.equals(r.get("format"))) {
                updates.add(new Object[] {label.language(), fmt, id});
            }
        }
        if (!updates.isEmpty()) db.batchUpdate("update shows set language = ?, format = ? where id = ?", updates);
    }

    /**
     * Seat rows of shows that already ran are never read again (a booking keeps its own seat list), but they were never
     * removed: every day added about 90,000 rows and the free database (1 GB limit) filled up, after which the server could
     * not even start. This removes the still-AVAILABLE seats of every show dated before today, in batches. Seats that are
     * BOOKED or LOCKED are kept so the admin consistency check keeps matching the bookings, and the show rows stay so old
     * tickets still open.
     */
    public void purgePastSeats() {
        for (int i = 0; i < 200; i++) {
            int n = db.update("""
                    delete from show_seats where id in (
                        select ss.id from show_seats ss join shows sh on sh.id = ss.show_id
                        where sh.show_date < (now() at time zone 'Asia/Kolkata')::date and ss.status = 'AVAILABLE'
                        limit 50000
                    )
                    """);
            if (n == 0) break;
        }
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
                         and (m.upcoming = false or (m.release_date is not null and m.release_date <= (now() at time zone 'Asia/Kolkata')::date + @ADV@))
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
                """.replace("@ADV@", String.valueOf(ADVANCE_BOOKING_DAYS)), WINDOW_DAYS - 1);

        // New shows need their seats too (10 rows A-J x 15 seats).
        db.update("""
                insert into show_seats(show_id,seat_number,seat_type)
                select sh.id, chr(65 + r) || n::text, case when r < 4 then 'PREMIUM' else 'REGULAR' end
                from shows sh cross join generate_series(0,9) r cross join generate_series(1,15) n
                where sh.show_date >= (now() at time zone 'Asia/Kolkata')::date
                  and (select count(*) from show_seats ss where ss.show_id = sh.id) < 150
                on conflict (show_id,seat_number) do nothing
                """);
    }
}
