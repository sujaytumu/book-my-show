package com.sujaytumu.bms.service;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Single source of truth for ticket prices.
 *
 * Base price is the price of the front ("Dress Class") rows: Rs 100 at single screens,
 * Rs 150 at multiplexes. Every other class is a percentage of that base.
 * Rows run A (back of the hall) to J (nearest the screen):
 *   A       Recliner      300%
 *   B-D     Balcony       150%
 *   E-G     Second Class  125%
 *   H-J     Dress Class   100%
 *
 * Premium formats add a flat fee per ticket on top of the seat price (formatFee): 3D +40, Dolby +60, PXL +80,
 * IMAX +120, 4DX 150 (4DX is always 3D, so it is all-in). 3D on top of Dolby, PXL or IMAX adds the 40 again.
 */
public final class Pricing {

    public static final double SINGLE_BASE = 100;
    public static final double MULTIPLEX_BASE = 150;

    private Pricing() {}

    public static boolean isMultiplex(String theatreType) {
        return "MULTIPLEX".equalsIgnoreCase(theatreType);
    }

    public static double base(String theatreType) {
        return isMultiplex(theatreType) ? MULTIPLEX_BASE : SINGLE_BASE;
    }

    public static String seatClass(String seatNumber) {
        char row = Character.toUpperCase(seatNumber.charAt(0));
        if (row == 'A') return "Recliner";
        if (row <= 'D') return "Balcony";
        if (row <= 'G') return "Second Class";
        return "Dress Class";
    }

    private static double multiplier(String seatClass) {
        return switch (seatClass) {
            case "Recliner" -> 3.0;
            case "Balcony" -> 1.5;
            case "Second Class" -> 1.25;
            default -> 1.0;
        };
    }

    public static double seatPrice(String theatreType, String seatNumber) {
        return round2(base(theatreType) * multiplier(seatClass(seatNumber)));
    }

    /** Flat per-ticket fee for a show format such as "2D", "3D", "Dolby 3D", "IMAX 2D", "4DX 3D", "PXL 3D". */
    public static double formatFee(String format) {
        if (format == null) return 0;
        String f = format.toUpperCase();
        if (f.contains("4DX")) return 150;
        double fee = f.contains("IMAX") ? 120 : f.contains("PXL") ? 80 : f.contains("DOLBY") ? 60 : 0;
        if (f.contains("3D")) fee += 40;
        return fee;
    }

    public static double seatPrice(String theatreType, String seatNumber, String format) {
        return round2(seatPrice(theatreType, seatNumber) + formatFee(format));
    }

    /** Class name -> price for a given show format, ordered back of the hall to front. */
    public static Map<String, Double> classPrices(String theatreType, String format) {
        Map<String, Double> prices = new LinkedHashMap<>();
        classPrices(theatreType).forEach((k, v) -> prices.put(k, round2(v + formatFee(format))));
        return prices;
    }

    /** Class name -> price, ordered back of the hall to front. */
    public static Map<String, Double> classPrices(String theatreType) {
        Map<String, Double> prices = new LinkedHashMap<>();
        for (String c : new String[] {"Recliner", "Balcony", "Second Class", "Dress Class"}) {
            prices.put(c, round2(base(theatreType) * multiplier(c)));
        }
        return prices;
    }

    private static double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
