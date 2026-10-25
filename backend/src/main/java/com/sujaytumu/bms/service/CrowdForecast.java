package com.sujaytumu.bms.service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Predicts how full a show will be by the time it starts, from what is sold now.
 *
 * <p>Sales are modelled as a curve: with {@code h} hours to go, about {@code 1/(1+h/24)} of a show's final sales are
 * already in (half a day out: two thirds; three days out: a quarter). So the projection is what is sold now plus the
 * part still to come, where the part still to come is the slot's typical final fill (weekend evenings are busiest,
 * weekday mornings quietest) scaled by how much of the curve is left. Early on the typical slot dominates; close to
 * showtime the actual sales take over. Pure Java so it can be unit tested.
 */
public final class CrowdForecast {

    private CrowdForecast() {}

    public record Forecast(String level, String label, int projectedPercent, int soldPercent, String tip) {}

    /** Typical final fill of a slot, 0-1. */
    static double prior(LocalDate date, LocalTime time) {
        DayOfWeek d = date.getDayOfWeek();
        boolean weekend = d == DayOfWeek.SATURDAY || d == DayOfWeek.SUNDAY;
        boolean friday = d == DayOfWeek.FRIDAY;
        int h = time.getHour();
        double slot;
        if (h < 11) slot = 0.30;
        else if (h < 15) slot = 0.42;
        else if (h < 18) slot = 0.55;
        else if (h < 22) slot = 0.72;
        else slot = 0.50;
        double day = weekend ? 1.20 : friday ? 1.10 : 0.85;
        return Math.min(0.95, slot * day);
    }

    static double soldShare(double hoursToGo) {
        return 1.0 / (1.0 + Math.max(0, hoursToGo) / 24.0);
    }

    public static Forecast forecast(LocalDateTime now, LocalDate date, LocalTime start, int total, int available) {
        if (total <= 0) return null;
        if (available <= 0) return new Forecast("full", "Housefull", 100, 100, "Sold out");
        double sold = (total - available) / (double) total;
        double hours = Math.max(0, java.time.Duration.between(now, date.atTime(start)).toMinutes() / 60.0);
        double projected = Math.min(1.0, sold + (1 - soldShare(hours)) * prior(date, start));
        int p = (int) Math.round(projected * 100);
        int s = (int) Math.round(sold * 100);
        String level;
        String label;
        String tip;
        if (projected >= 0.90) {
            level = "rush";
            label = "Likely to sell out";
            tip = "Book soon, the good seats will go first";
        } else if (projected >= 0.70) {
            level = "busy";
            label = "Filling fast";
            tip = "Busy show, pick your seats early";
        } else if (projected >= 0.45) {
            level = "steady";
            label = "Steady crowd";
            tip = "Comfortable, plenty of choice for now";
        } else {
            level = "quiet";
            label = "Quiet show";
            tip = "Calm and roomy, best seats should stay free";
        }
        return new Forecast(level, label, p, s, tip);
    }
}
