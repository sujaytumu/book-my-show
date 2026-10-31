package com.sujaytumu.bms.service;

import com.sujaytumu.bms.service.MovieLookupService.Candidate;
import com.sujaytumu.bms.service.MovieLookupService.Details;
import java.sql.Date;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Applies what the movie database knows to our own movies table.
 *
 * <ul>
 *   <li>{@link #createFromLookup}: a new movie from a picked search result (poster, language, genre, runtime,
 *       certificate, India release date, cast and crew with photos; "upcoming" is worked out from the date, and the
 *       existing release automation then moves it to Now Showing and gives it screens on its release day);</li>
 *   <li>{@link #enrich}: fills the blanks of a movie we already have (never overwrites what an admin typed unless
 *       asked to); used by the admin "Auto-fill" button, by adding a movie with only a title, and by the daily job.</li>
 * </ul>
 */
@Service
public class MovieEnricher {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    /** Outcome of one auto-fill, small enough to show to an admin. */
    public record Result(boolean matched, boolean configured, Long tmdbId, String matchedTitle,
                         List<String> filled, String note, List<Candidate> suggestions) {}

    private final JdbcTemplate db;
    private final MovieLookupService lookup;

    public MovieEnricher(JdbcTemplate db, MovieLookupService lookup) {
        this.db = db;
        this.lookup = lookup;
    }

    public boolean configured() {
        return lookup.configured();
    }

    private static boolean blank(Object v) {
        return v == null || String.valueOf(v).isBlank() || (v instanceof Number n && n.doubleValue() == 0);
    }

    // ---- a new movie from a picked search result ---------------------------------------------------------------

    public Map<String, Object> createFromLookup(long tmdbId) {
        Map<String, Object> out = new LinkedHashMap<>();
        List<Long> existing = db.queryForList("select id from movies where tmdb_id = ?", Long.class, tmdbId);
        if (!existing.isEmpty()) {
            out.put("status", "exists");
            out.put("id", existing.get(0));
            return out;
        }
        Details d = lookup.details(tmdbId);
        // Same title already added by hand? Complete that one instead of making a duplicate.
        List<Long> sameTitle = db.queryForList(
                "select id from movies where tmdb_id is null and lower(title) = lower(?) limit 1", Long.class, d.title());
        if (!sameTitle.isEmpty()) {
            long id = sameTitle.get(0);
            Result r = apply(id, d, false);
            out.put("status", "completed");
            out.put("id", id);
            out.put("filled", r.filled());
            return out;
        }
        boolean upcoming = isFuture(d.releaseDate());
        Long id = db.queryForObject(
                "insert into movies(title,description,poster_url,language,genre,duration_minutes,certificate,rating," +
                        "release_date,upcoming,cast_crew,tmdb_id,trailer_key,meta_source,details_synced_at,active) " +
                        "values(?,?,?,?,?,?,?,?,?,?,?,?,?,'tmdb',now(),true) returning id",
                Long.class, d.title(), d.description(), d.posterUrl(), d.language(), d.genre(), d.durationMinutes(),
                d.certificate(), d.rating() == null ? 0 : d.rating(), d.releaseDate() == null ? null : Date.valueOf(d.releaseDate()),
                upcoming, d.castCrewJson(), d.tmdbId(), d.trailerKey());
        out.put("status", "created");
        out.put("id", id);
        out.put("title", d.title());
        out.put("upcoming", upcoming);
        out.put("releaseDate", d.releaseDate());
        return out;
    }

    private static boolean isFuture(String isoDate) {
        return isoDate != null && LocalDate.parse(isoDate).isAfter(LocalDate.now(IST));
    }

    // ---- filling an existing movie -----------------------------------------------------------------------------

    /**
     * @param overwrite replace values that are already filled in (admin asked for a full refresh)
     * @param strict    unattended mode (daily job): only accept an exact title + matching year/language
     */
    public Result enrich(long movieId, boolean overwrite, boolean strict) {
        if (!lookup.configured()) {
            return new Result(false, false, null, null, List.of(),
                    "Movie lookup is not set up yet: add TMDB_API_KEY (free at themoviedb.org) to the server settings.", List.of());
        }
        Map<String, Object> m = db.queryForMap(
                "select title, language, release_date, tmdb_id from movies where id = ?", movieId);
        Long tmdbId = m.get("tmdb_id") == null ? null : ((Number) m.get("tmdb_id")).longValue();
        List<Candidate> suggestions = List.of();
        if (tmdbId == null) {
            Integer year = m.get("release_date") == null ? null : ((Date) m.get("release_date")).toLocalDate().getYear();
            List<Candidate> found = lookup.search((String) m.get("title"), null);
            Optional<Candidate> best = MovieLookupService.bestMatch((String) m.get("title"), year,
                    (String) m.get("language"), found, strict);
            if (best.isEmpty()) {
                db.update("update movies set details_synced_at = now() where id = ?", movieId);
                return new Result(false, true, null, null, List.of(),
                        found.isEmpty() ? "No movie with that name was found in the movie database."
                                : "No confident match. Pick the right film from the suggestions.",
                        found.stream().limit(5).toList());
            }
            tmdbId = best.get().tmdbId();
        }
        return apply(movieId, lookup.details(tmdbId), overwrite);
    }

    private Result apply(long movieId, Details d, boolean overwrite) {
        Map<String, Object> before = db.queryForMap(
                "select description, poster_url, language, genre, duration_minutes, certificate, rating, release_date, cast_crew, trailer_key " +
                        "from movies where id = ?", movieId);
        List<String> sets = new ArrayList<>();
        List<Object> args = new ArrayList<>();
        List<String> filled = new ArrayList<>();
        put(sets, args, filled, overwrite, before.get("description"), "description", "description", d.description());
        Object curPoster = before.get("poster_url");
        if (curPoster != null && String.valueOf(curPoster).startsWith("/posters/placeholder-")) curPoster = null; // stand-in, replace it
        put(sets, args, filled, overwrite, curPoster, "poster_url", "poster", d.posterUrl());
        put(sets, args, filled, overwrite, before.get("language"), "language", "language", d.language());
        put(sets, args, filled, overwrite, before.get("genre"), "genre", "genre", d.genre());
        put(sets, args, filled, overwrite, before.get("duration_minutes"), "duration_minutes", "duration", d.durationMinutes());
        put(sets, args, filled, overwrite, before.get("certificate"), "certificate", "certificate", d.certificate());
        put(sets, args, filled, overwrite, before.get("rating"), "rating", "rating", d.rating());
        put(sets, args, filled, overwrite, before.get("cast_crew"), "cast_crew", "cast & crew", d.castCrewJson());
        put(sets, args, filled, overwrite, before.get("trailer_key"), "trailer_key", "trailer", d.trailerKey());
        boolean hadDate = !blank(before.get("release_date"));
        if (d.releaseDate() != null && (overwrite || !hadDate)) {
            sets.add("release_date = ?");
            args.add(Date.valueOf(d.releaseDate()));
            filled.add("release date");
            if (!hadDate || overwrite) {
                sets.add("upcoming = ?");
                args.add(isFuture(d.releaseDate()));
            }
        }
        sets.add("tmdb_id = ?");
        args.add(d.tmdbId());
        sets.add("meta_source = 'tmdb'");
        sets.add("details_synced_at = now()");
        args.add(movieId);
        db.update("update movies set " + String.join(", ", sets) + " where id = ?", args.toArray());
        return new Result(true, true, d.tmdbId(), d.title(), filled,
                filled.isEmpty() ? "Everything was already filled in." : "Filled in: " + String.join(", ", filled) + ".", List.of());
    }

    private static void put(List<String> sets, List<Object> args, List<String> filled, boolean overwrite,
                            Object current, String column, String label, Object value) {
        if (value == null || (!overwrite && !blank(current))) return;
        sets.add(column + " = ?");
        args.add(value);
        filled.add(label);
    }

    /**
     * Weekly touch-up for movies that came from the movie database and have not been released yet: release dates
     * and posters move, and cast gets confirmed. Only fields that actually differ are written.
     */
    public boolean refreshUpcoming(long movieId) {
        Map<String, Object> m = db.queryForMap("select tmdb_id from movies where id = ?", movieId);
        if (m.get("tmdb_id") == null) return false;
        Details d = lookup.details(((Number) m.get("tmdb_id")).longValue());
        Map<String, Object> b = db.queryForMap("select release_date, poster_url, cast_crew from movies where id = ?", movieId);
        List<String> sets = new ArrayList<>();
        List<Object> args = new ArrayList<>();
        if (d.releaseDate() != null && (b.get("release_date") == null || !b.get("release_date").toString().equals(d.releaseDate()))) {
            sets.add("release_date = ?");
            args.add(Date.valueOf(d.releaseDate()));
            sets.add("upcoming = ?");
            args.add(isFuture(d.releaseDate()));
        }
        if (d.posterUrl() != null && !d.posterUrl().equals(b.get("poster_url"))
                && (b.get("poster_url") == null || String.valueOf(b.get("poster_url")).startsWith("https://image.tmdb.org/"))) {
            sets.add("poster_url = ?");
            args.add(d.posterUrl());
        }
        Object curCast = b.get("cast_crew");
        boolean castIsOurs = curCast == null || String.valueOf(curCast).isBlank() || String.valueOf(curCast).contains("image.tmdb.org");
        if (d.castCrewJson() != null && castIsOurs && !d.castCrewJson().equals(curCast)) { // never replace a hand-written cast list
            sets.add("cast_crew = ?");
            args.add(d.castCrewJson());
        }
        sets.add("details_synced_at = now()");
        args.add(movieId);
        db.update("update movies set " + String.join(", ", sets) + " where id = ?", args.toArray());
        return sets.size() > 1;
    }
}
