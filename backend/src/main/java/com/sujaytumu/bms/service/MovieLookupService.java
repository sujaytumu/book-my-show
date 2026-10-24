package com.sujaytumu.bms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Fetches everything about a movie from its name, so adding a film never means typing in posters, cast or dates.
 *
 * <p>Source: TMDB (The Movie Database), which has a free API. Set {@code TMDB_API_KEY} to either the "API Key (v3)" or
 * the "API Read Access Token" from your TMDB account settings. The network calls are thin; all the interpretation
 * (language names, India certificate, India release date, cast and crew roles, matching a typed title to a result)
 * is in static methods that work on plain JSON so they can be tested without the network.
 */
@Service
public class MovieLookupService {

    static final String API = "https://api.themoviedb.org/3";
    static final String IMG = "https://image.tmdb.org/t/p/";
    private static final ObjectMapper JSON = new ObjectMapper();

    /** A search hit (enough to recognise the film and pick the right one). */
    public record Candidate(
            long tmdbId, String title, String originalTitle, String year, String releaseDate,
            String language, String poster, String overview, double popularity) {}

    /** Everything we store about a movie. {@code castCrew} is already the JSON text kept in movies.cast_crew. */
    public record Details(
            long tmdbId, String title, String originalTitle, String description, String posterUrl, String backdropUrl,
            String language, String genre, Integer durationMinutes, String certificate, String releaseDate,
            Double rating, List<Map<String, Object>> castCrew, String trailerKey, String imdbId) {

        public String castCrewJson() {
            try {
                return castCrew == null || castCrew.isEmpty() ? null : JSON.writeValueAsString(castCrew);
            } catch (IOException e) {
                return null;
            }
        }
    }

    /** The lookup could not be completed (bad key, network, rate limit). The message is safe to show an admin. */
    public static class LookupException extends RuntimeException {
        public LookupException(String message) {
            super(message);
        }
    }

    private final String key;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(6)).build();

    public MovieLookupService(@Value("${tmdb.key:}") String key) {
        this.key = key == null ? "" : key.trim();
    }

    public boolean configured() {
        return !key.isEmpty();
    }

    // ---- network ------------------------------------------------------------------------------------------------

    private boolean bearer() {
        return key.startsWith("eyJ"); // the v4 "read access token" is a JWT; the v3 key is 32 hex characters
    }

    private String get(String path, String query) {
        if (!configured()) throw new LookupException("Movie lookup is not set up: add TMDB_API_KEY (free at themoviedb.org).");
        String url = API + path + "?" + query + (bearer() ? "" : "&api_key=" + enc(key));
        for (int attempt = 1; ; attempt++) {
            try {
                HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(8))
                        .header("Accept", "application/json");
                if (bearer()) b.header("Authorization", "Bearer " + key);
                HttpResponse<String> r = http.send(b.GET().build(), HttpResponse.BodyHandlers.ofString());
                int s = r.statusCode();
                if (s == 200) return r.body();
                if (s == 401) throw new LookupException("TMDB rejected the API key (401). Check TMDB_API_KEY.");
                if (s == 404) throw new LookupException("That movie was not found in the movie database.");
                if ((s == 429 || s >= 500) && attempt < 2) {
                    Thread.sleep(600);
                    continue;
                }
                throw new LookupException("The movie database answered " + s + ". Try again in a minute.");
            } catch (IOException e) {
                if (attempt >= 2) throw new LookupException("Could not reach the movie database right now.");
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new LookupException("Movie lookup was interrupted.");
            }
        }
    }

    private static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }

    public List<Candidate> search(String query, Integer year) {
        String q = "query=" + enc(query.trim()) + "&include_adult=false&language=en-US&page=1"
                + (year != null ? "&year=" + year : "");
        return parseSearch(readTree(get("/search/movie", q)));
    }

    public Details details(long tmdbId) {
        return parseDetails(readTree(get("/movie/" + tmdbId,
                "language=en-US&append_to_response=credits,release_dates,videos")));
    }

    private static JsonNode readTree(String body) {
        try {
            return JSON.readTree(body);
        } catch (IOException e) {
            throw new LookupException("The movie database sent something unreadable.");
        }
    }

    // ---- interpretation (pure) ----------------------------------------------------------------------------------

    private static final Map<String, String> LANGUAGES = Map.ofEntries(
            Map.entry("te", "Telugu"), Map.entry("ta", "Tamil"), Map.entry("hi", "Hindi"), Map.entry("ml", "Malayalam"),
            Map.entry("kn", "Kannada"), Map.entry("bn", "Bengali"), Map.entry("mr", "Marathi"), Map.entry("pa", "Punjabi"),
            Map.entry("gu", "Gujarati"), Map.entry("or", "Odia"), Map.entry("ur", "Urdu"), Map.entry("en", "English"),
            Map.entry("ko", "Korean"), Map.entry("ja", "Japanese"), Map.entry("zh", "Chinese"), Map.entry("fr", "French"),
            Map.entry("es", "Spanish"), Map.entry("de", "German"), Map.entry("it", "Italian"), Map.entry("th", "Thai"),
            Map.entry("ru", "Russian"), Map.entry("pt", "Portuguese"), Map.entry("ar", "Arabic"), Map.entry("tr", "Turkish"));

    static String languageName(JsonNode n) {
        String iso = n.path("original_language").asText("");
        if (LANGUAGES.containsKey(iso)) return LANGUAGES.get(iso);
        for (JsonNode l : n.path("spoken_languages")) {
            if (iso.equals(l.path("iso_639_1").asText())) {
                String name = l.path("english_name").asText("");
                if (!name.isBlank()) return name;
            }
        }
        return iso.isBlank() ? null : iso.toUpperCase();
    }

    private static String text(JsonNode n, String field) {
        String v = n.path(field).asText("").trim();
        return v.isEmpty() || "null".equals(v) ? null : v;
    }

    private static String img(String size, JsonNode n, String field) {
        String p = text(n, field);
        return p == null ? null : IMG + size + p;
    }

    public static List<Candidate> parseSearch(JsonNode root) {
        List<Candidate> out = new ArrayList<>();
        for (JsonNode r : root.path("results")) {
            String date = text(r, "release_date");
            String overview = text(r, "overview");
            if (overview != null && overview.length() > 220) overview = overview.substring(0, 217) + "...";
            out.add(new Candidate(r.path("id").asLong(), text(r, "title"), text(r, "original_title"),
                    date != null && date.length() >= 4 ? date.substring(0, 4) : null, date,
                    languageName(r), img("w342", r, "poster_path"), overview, r.path("popularity").asDouble(0)));
        }
        return out;
    }

    /** India's theatrical release date if TMDB has one (it can differ from the world premiere), else the main date. */
    static String releaseDate(JsonNode n) {
        String best = null;
        for (JsonNode country : n.path("release_dates").path("results")) {
            if (!"IN".equals(country.path("iso_3166_1").asText())) continue;
            for (JsonNode rd : country.path("release_dates")) {
                int type = rd.path("type").asInt();
                String d = text(rd, "release_date");
                if ((type == 3 || type == 2) && d != null && d.length() >= 10) {
                    String day = d.substring(0, 10);
                    if (best == null || day.compareTo(best) < 0) best = day;
                }
            }
        }
        if (best != null) return best;
        String d = text(n, "release_date");
        return d != null && d.length() >= 10 ? d.substring(0, 10) : null;
    }

    /** Indian certificate when present (U / UA / A / S), else the US rating mapped to the nearest Indian one. */
    static String certificate(JsonNode n) {
        String us = null;
        for (JsonNode country : n.path("release_dates").path("results")) {
            String iso = country.path("iso_3166_1").asText();
            for (JsonNode rd : country.path("release_dates")) {
                String c = rd.path("certification").asText("").trim().toUpperCase();
                if (c.isEmpty()) continue;
                if ("IN".equals(iso)) {
                    if (c.startsWith("UA")) return "UA";
                    if (c.equals("A") || c.startsWith("A ")) return "A";
                    if (c.startsWith("U")) return "U";
                    if (c.startsWith("S")) return "S";
                    return c.length() > 4 ? c.substring(0, 4) : c;
                }
                if ("US".equals(iso) && us == null) us = c;
            }
        }
        if (us == null) return null;
        return switch (us) {
            case "G" -> "U";
            case "PG", "PG-13" -> "UA";
            case "R", "NC-17" -> "A";
            default -> null;
        };
    }

    static List<Map<String, Object>> castCrew(JsonNode credits) {
        List<Map<String, Object>> out = new ArrayList<>();
        int actors = 0;
        for (JsonNode c : credits.path("cast")) {
            if (actors >= 12) break;
            String name = text(c, "name");
            if (name == null) continue;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("name", name);
            m.put("role", "Actor");
            String ch = text(c, "character");
            if (ch != null) m.put("character", ch);
            String photo = img("w185", c, "profile_path");
            if (photo != null) m.put("photo", photo);
            out.add(m);
            actors++;
        }
        // role name -> (jobs that count, how many to keep); role names are chosen so the app files them under Crew
        Map<String, Integer> caps = new LinkedHashMap<>();
        Map<String, Integer> used = new LinkedHashMap<>();
        for (String role : new String[] {"Director", "Producer", "Music Director", "Writer", "Cinematography", "Editor"}) {
            caps.put(role, role.equals("Director") || role.equals("Producer") || role.equals("Writer") ? 2 : 1);
            used.put(role, 0);
        }
        List<Map<String, Object>> crew = new ArrayList<>();
        for (JsonNode c : credits.path("crew")) {
            String role = switch (c.path("job").asText("")) {
                case "Director" -> "Director";
                case "Producer" -> "Producer";
                case "Original Music Composer", "Music", "Composer" -> "Music Director";
                case "Screenplay", "Writer", "Story" -> "Writer";
                case "Director of Photography" -> "Cinematography";
                case "Editor" -> "Editor";
                default -> null;
            };
            String name = text(c, "name");
            if (role == null || name == null || used.get(role) >= caps.get(role)) continue;
            boolean dup = crew.stream().anyMatch(x -> x.get("name").equals(name) && x.get("role").equals(role));
            if (dup) continue;
            used.merge(role, 1, Integer::sum);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("name", name);
            m.put("role", role);
            String photo = img("w185", c, "profile_path");
            if (photo != null) m.put("photo", photo);
            crew.add(m);
        }
        crew.sort((a, b) -> Integer.compare(
                new ArrayList<>(caps.keySet()).indexOf((String) a.get("role")),
                new ArrayList<>(caps.keySet()).indexOf((String) b.get("role"))));
        out.addAll(crew);
        return out;
    }

    static String trailerKey(JsonNode videos) {
        String fallback = null;
        for (JsonNode v : videos.path("results")) {
            if (!"YouTube".equals(v.path("site").asText()) || !"Trailer".equals(v.path("type").asText())) continue;
            String k = text(v, "key");
            if (k == null) continue;
            if (v.path("official").asBoolean(false)) return k;
            if (fallback == null) fallback = k;
        }
        return fallback;
    }

    public static Details parseDetails(JsonNode n) {
        List<String> genres = new ArrayList<>();
        for (JsonNode g : n.path("genres")) {
            String name = text(g, "name");
            if (name != null && genres.size() < 3) genres.add(name);
        }
        int runtime = n.path("runtime").asInt(0);
        String overview = text(n, "overview");
        if (overview == null) overview = text(n, "tagline");
        Double rating = null;
        if (n.path("vote_count").asInt(0) >= 50 && n.path("vote_average").asDouble(0) > 0) {
            rating = Math.round(n.path("vote_average").asDouble() * 10.0) / 10.0;
        }
        return new Details(n.path("id").asLong(), text(n, "title"), text(n, "original_title"), overview,
                img("w500", n, "poster_path"), img("w780", n, "backdrop_path"), languageName(n),
                genres.isEmpty() ? null : String.join(", ", genres), runtime > 0 ? runtime : null,
                certificate(n), releaseDate(n), rating, castCrew(n.path("credits")),
                trailerKey(n.path("videos")), text(n, "imdb_id"));
    }

    // ---- matching a typed title to a search result --------------------------------------------------------------

    static String norm(String s) {
        if (s == null) return "";
        String d = java.text.Normalizer.normalize(s, java.text.Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return d.toLowerCase().replaceAll("[^a-z0-9]", "");
    }

    static double similarity(String a, String b) {
        if (a.isEmpty() || b.isEmpty()) return 0;
        if (a.equals(b)) return 1;
        int[] prev = new int[b.length() + 1];
        int[] cur = new int[b.length() + 1];
        for (int j = 0; j <= b.length(); j++) prev[j] = j;
        for (int i = 1; i <= a.length(); i++) {
            cur[0] = i;
            for (int j = 1; j <= b.length(); j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                cur[j] = Math.min(Math.min(cur[j - 1] + 1, prev[j] + 1), prev[j - 1] + cost);
            }
            int[] t = prev;
            prev = cur;
            cur = t;
        }
        return 1.0 - (double) prev[b.length()] / Math.max(a.length(), b.length());
    }

    /**
     * The search result that is the film the admin meant, or empty if none is convincing. {@code strict} (used by the
     * automatic background fill, where nobody is there to confirm) needs an exact title and a matching year/language.
     */
    public static Optional<Candidate> bestMatch(String title, Integer year, String language,
                                                List<Candidate> candidates, boolean strict) {
        String want = norm(title);
        Candidate best = null;
        double bestScore = -1;
        for (Candidate c : candidates) {
            double score = Math.max(similarity(want, norm(c.title())), similarity(want, norm(c.originalTitle())));
            if (score < (strict ? 0.999 : 0.82)) continue;
            if (strict) {
                if (year != null && c.year() != null) {
                    try {
                        if (Math.abs(Integer.parseInt(c.year()) - year) > 1) continue;
                    } catch (NumberFormatException ignored) {
                        continue;
                    }
                }
                if (language != null && !language.isBlank() && c.language() != null
                        && !c.language().equalsIgnoreCase(language.trim())) continue;
            }
            double rank = score * 1000 + Math.min(c.popularity(), 999) / 1000.0;
            if (rank > bestScore) {
                bestScore = rank;
                best = c;
            }
        }
        return Optional.ofNullable(best);
    }
}
