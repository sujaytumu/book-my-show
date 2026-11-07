package com.sujaytumu.bms.service;

import java.time.LocalTime;
import java.util.List;
import java.util.Map;

/**
 * How a big, multi-language release (Ramayana) is spread over the screens, the way it plays in real cinemas:
 * single screens play it in the local language, in plain 2D with the odd 3D show; multiplexes mix languages
 * (local language and Hindi most, then Telugu, English, Tamil...) and put the premium formats (IMAX, Dolby, 4DX, PXL)
 * on the screens that have them, mostly in the evening. The choice is a pure function of the show, so running it
 * again gives the same answer and nothing flips from one run to the next.
 */
public final class ReleaseVariants {

    public record Label(String language, String format) {}

    private ReleaseVariants() {}

    // Premium screens by cinema. This models the usual set-up; it is not a feed from the cinemas themselves.
    private static final Map<String, List<String>> PREMIUM = Map.ofEntries(
            Map.entry("Prasads Multiplex", List.of("IMAX 2D", "IMAX 3D")),
            Map.entry("AMB Cinemas", List.of("Dolby 2D", "Dolby 3D")),
            Map.entry("PVR LakeShore Mall", List.of("PXL 3D", "Dolby 2D")),
            Map.entry("PVR Nexus Mall", List.of("Dolby 2D", "4DX 3D")),
            Map.entry("Cinepolis Lulu Mall", List.of("4DX 3D", "Dolby 3D")),
            Map.entry("PVR Superplex (Inorbit Mall)", List.of("PXL 3D", "Dolby 2D")),
            Map.entry("PVR ICON Next Galleria Mall", List.of("Dolby 3D")),
            Map.entry("INOX GVK One Mall", List.of("Dolby 3D")),
            Map.entry("AAA Cinemas", List.of("Dolby 3D")),
            Map.entry("Allu Cinemas", List.of("Dolby 2D", "Dolby 3D")));
    private static final List<String> OTHER_MULTIPLEX = List.of("Dolby 2D");

    // Language mix on a multiplex screen, by region: {language, share in %}. Shares add up to 100.
    private static final String[][] TELUGU_REGION = {{"Telugu", "45"}, {"Hindi", "33"}, {"Tamil", "9"}, {"English", "9"}, {"Kannada", "2"}, {"Malayalam", "2"}};
    private static final String[][] TAMIL_REGION = {{"Tamil", "45"}, {"Telugu", "20"}, {"Hindi", "20"}, {"English", "9"}, {"Malayalam", "3"}, {"Kannada", "3"}};
    private static final String[][] KANNADA_REGION = {{"Kannada", "40"}, {"Telugu", "20"}, {"Hindi", "20"}, {"English", "9"}, {"Tamil", "7"}, {"Malayalam", "4"}};
    private static final String[][] HINDI_REGION = {{"Hindi", "55"}, {"Telugu", "18"}, {"English", "12"}, {"Tamil", "8"}, {"Malayalam", "4"}, {"Kannada", "3"}};

    private static String[][] mix(String city) {
        String c = city == null ? "" : city.toLowerCase();
        if (c.equals("chennai")) return TAMIL_REGION;
        if (c.equals("bengaluru")) return KANNADA_REGION;
        if (c.equals("mumbai") || c.equals("kolkata") || c.startsWith("delhi")) return HINDI_REGION;
        return TELUGU_REGION;
    }

    private static String localLanguage(String city) {
        return mix(city)[0][0];
    }

    private static double frac(long id, double k) {
        double x = id * k;
        return x - Math.floor(x);
    }

    public static Label label(long showId, String city, String theatreName, String theatreType, LocalTime start) {
        boolean multiplex = "MULTIPLEX".equalsIgnoreCase(theatreType);
        boolean evening = start != null && !start.isBefore(LocalTime.of(17, 30));
        double h1 = frac(showId, 0.6180339887);
        double h2 = frac(showId, 0.7548776662);
        double h3 = frac(showId, 0.5698402909);

        if (!multiplex) {
            // Single screens: local language, plain 2D, with the odd 3D show (more at a 3D-equipped hall like Arjun).
            double threeD = theatreName != null && theatreName.contains("Arjun") ? 0.35 : 0.12;
            return new Label(localLanguage(city), h2 < threeD ? "3D" : "2D");
        }

        double cut = 0;
        String language = mix(city)[0][0];
        for (String[] row : mix(city)) {
            cut += Double.parseDouble(row[1]) / 100.0;
            if (h1 < cut) {
                language = row[0];
                break;
            }
        }

        List<String> premium = PREMIUM.getOrDefault(theatreName, OTHER_MULTIPLEX);
        String format;
        if (h2 < (evening ? 0.55 : 0.30)) {
            format = premium.get((int) Math.min(premium.size() - 1, Math.floor(h3 * premium.size())));
        } else {
            format = h3 < (evening ? 0.65 : 0.25) ? "3D" : "2D";
        }
        return new Label(language, format);
    }
}
