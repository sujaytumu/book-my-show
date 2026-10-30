package com.sujaytumu.bms.scheduler;

import com.sujaytumu.bms.service.MovieEnricher;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Keeps movie details complete without anyone touching them.
 *
 * <p>Two jobs, both quiet no-ops until TMDB_API_KEY is set, and both limited to a handful of movies per run so they
 * never hammer the movie database:
 * <ol>
 *   <li>Movies that are missing a poster, description, genre, language, runtime, release date or cast get the gaps
 *       filled from the movie database. Only blanks are filled, and only when the match is certain (exact title, and
 *       the year and language agree), because nobody is there to confirm it.</li>
 *   <li>Upcoming movies that came from the movie database get a weekly refresh, because release dates and posters
 *       move: when a date changes, the existing release automation follows it.</li>
 * </ol>
 */
@Component
public class MovieEnrichmentScheduler {

    private static final Logger log = LoggerFactory.getLogger(MovieEnrichmentScheduler.class);

    private final JdbcTemplate db;
    private final MovieEnricher enricher;

    public MovieEnrichmentScheduler(JdbcTemplate db, MovieEnricher enricher) {
        this.db = db;
        this.enricher = enricher;
    }

    /** Two minutes after start (so a fresh deploy completes new movies at once), then every 6 hours. */
    @Scheduled(initialDelay = 120_000, fixedDelay = 6 * 3_600_000L)
    public void run() {
        if (!enricher.configured()) return;
        fillIncomplete();
        refreshUpcoming();
    }

    void fillIncomplete() {
        List<Long> ids;
        try {
            ids = db.queryForList("""
                    select id from movies
                    where active = true
                      and (poster_url is null or poster_url = '' or description is null or description = ''
                           or genre is null or genre = '' or language is null or language = ''
                           or duration_minutes is null or release_date is null
                           or cast_crew is null or cast_crew = ''
                           or (tmdb_id is not null and trailer_key is null))
                      and (details_synced_at is null or details_synced_at < now() - interval '3 days')
                    order by id limit 12
                    """, Long.class);
        } catch (RuntimeException e) {
            log.warn("Movie auto-fill could not list movies: {}", e.getMessage());
            return;
        }
        for (Long id : ids) {
            try {
                var r = enricher.enrich(id, false, true);
                log.info("Movie {} auto-fill: {}", id, r.note());
            } catch (RuntimeException e) {
                log.warn("Movie {} auto-fill failed: {}", id, e.getMessage());
                // Remember the attempt so one broken movie is not retried every run.
                try { db.update("update movies set details_synced_at = now() where id = ?", id); } catch (RuntimeException ignored) { }
            }
        }
    }

    void refreshUpcoming() {
        List<Long> ids;
        try {
            ids = db.queryForList("""
                    select id from movies
                    where active = true and upcoming = true and meta_source = 'tmdb' and tmdb_id is not null
                      and (details_synced_at is null or details_synced_at < now() - interval '7 days')
                    order by details_synced_at nulls first limit 12
                    """, Long.class);
        } catch (RuntimeException e) {
            log.warn("Movie refresh could not list movies: {}", e.getMessage());
            return;
        }
        for (Long id : ids) {
            try {
                if (enricher.refreshUpcoming(id)) log.info("Movie {} refreshed from the movie database", id);
            } catch (RuntimeException e) {
                log.warn("Movie {} refresh failed: {}", id, e.getMessage());
                try { db.update("update movies set details_synced_at = now() where id = ?", id); } catch (RuntimeException ignored) { }
            }
        }
    }
}
