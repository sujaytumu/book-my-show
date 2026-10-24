package com.sujaytumu.bms.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

/**
 * Picks the best seats for a party, the way a cinema regular would.
 *
 * <p>Every seat gets a view-quality score (0-100) from two things: how deep in the hall it is (about 60% of the way
 * back from the screen is the sweet spot; the front rows strain the neck) and how central it is in its row. For a
 * party of N we look at every run of N free, side-by-side seats in a row and score the run by its average quality,
 * then adjust it:
 * <ul>
 *   <li>a run that would leave a lonely single seat next to it (between the party and a taken seat or the wall) is
 *       penalised, so the hall does not fill up with unsellable one-seat gaps;</li>
 *   <li>a run split by the aisle is penalised;</li>
 *   <li>in {@code value} mode the class price is traded off against the view.</li>
 * </ul>
 * If no row has N free seats together, the party is split into the biggest groups that exist, kept in neighbouring
 * rows. Pure Java (no Spring) so it is trivial to test.
 */
public final class SeatAdvisor {

    /** Where the ideal row is, as a fraction of the hall depth measured from the screen (0 = front, 1 = back). */
    static final double IDEAL_DEPTH = 0.60;
    static final double ORPHAN_PENALTY = 13;
    static final double AISLE_PENALTY = 9;
    static final int AISLE_EVERY = 5; // the seat map leaves an aisle after every 5th seat

    private SeatAdvisor() {}

    public record Seat(String number, boolean available) {}

    public record Advice(
            int count,
            boolean together,
            List<String> seats,
            int score,
            String label,
            List<String> reasons,
            List<List<String>> alternatives,
            double total,
            Map<String, Integer> heat) {}

    // ---- hall model ---------------------------------------------------------------------------------------------

    private static final class Hall {
        final List<Character> rows = new ArrayList<>(); // A (back) ... last (front)
        final Map<Character, TreeMap<Integer, Boolean>> cols = new TreeMap<>();

        int rowIndex(char row) {
            return rows.indexOf(row);
        }

        int maxCol(char row) {
            return cols.get(row).lastKey();
        }
    }

    private static Hall parse(List<Seat> seats) {
        Hall hall = new Hall();
        for (Seat s : seats) {
            String n = s.number();
            if (n == null || n.length() < 2) continue;
            char row = Character.toUpperCase(n.charAt(0));
            int col;
            try {
                col = Integer.parseInt(n.substring(1));
            } catch (NumberFormatException e) {
                continue;
            }
            hall.cols.computeIfAbsent(row, r -> new TreeMap<>()).put(col, s.available());
        }
        hall.rows.addAll(hall.cols.keySet());
        return hall;
    }

    /** View quality of one seat, 0-100. */
    static double quality(int rowIdx, int rowCount, int col, int maxCol) {
        double depth = rowCount <= 1 ? IDEAL_DEPTH : (double) (rowCount - 1 - rowIdx) / (rowCount - 1);
        double rowPen = Math.min(1.0, Math.abs(depth - IDEAL_DEPTH) / 0.6);
        double mid = (maxCol + 1) / 2.0;
        double colOff = maxCol <= 1 ? 0 : Math.abs(col - mid) / ((maxCol - 1) / 2.0);
        double q = 1.0 - 0.6 * Math.pow(rowPen, 1.2) - 0.4 * Math.pow(Math.min(1.0, colOff), 1.4);
        return Math.max(0, Math.min(100, q * 100));
    }

    private static double multiplier(String theatreType, String seatNumber) {
        double base = Pricing.base(theatreType);
        return base == 0 ? 1 : Pricing.seatPrice(theatreType, seatNumber) / base;
    }

    // ---- candidate runs -----------------------------------------------------------------------------------------

    private record Run(char row, int from, int size, double score, double colOffset, int orphans, boolean aisle) {
        List<String> seats() {
            List<String> out = new ArrayList<>();
            for (int c = from; c < from + size; c++) out.add("" + row + c);
            return out;
        }
    }

    private static boolean free(Hall hall, char row, int col, Set<String> taken) {
        Boolean a = hall.cols.get(row).get(col);
        return a != null && a && !taken.contains("" + row + col);
    }

    private static List<Run> runs(Hall hall, int size, boolean valueMode, String theatreType, Set<String> taken) {
        List<Run> out = new ArrayList<>();
        int rowCount = hall.rows.size();
        for (char row : hall.rows) {
            int ri = hall.rowIndex(row);
            int maxCol = hall.maxCol(row);
            for (int from = hall.cols.get(row).firstKey(); from + size - 1 <= maxCol; from++) {
                boolean ok = true;
                for (int c = from; c < from + size && ok; c++) ok = free(hall, row, c, taken);
                if (!ok) continue;

                double sum = 0;
                for (int c = from; c < from + size; c++) sum += quality(ri, rowCount, c, maxCol);
                double score = sum / size;

                int orphans = 0;
                int left = from - 1;
                int right = from + size;
                if (free(hall, row, left, taken) && !free(hall, row, left - 1, taken)) orphans++;
                if (free(hall, row, right, taken) && !free(hall, row, right + 1, taken)) orphans++;
                score -= ORPHAN_PENALTY * orphans;

                boolean aisle = false;
                for (int c = from; c < from + size - 1; c++) if (c % AISLE_EVERY == 0) aisle = true;
                if (aisle) score -= AISLE_PENALTY;

                if (valueMode) score -= 11 * (multiplier(theatreType, "" + row + from) - 1);

                double mid = (maxCol + 1) / 2.0;
                double colOffset = Math.abs((from + (size - 1) / 2.0) - mid);
                out.add(new Run(row, from, size, score, colOffset, orphans, aisle));
            }
        }
        out.sort(Comparator.comparingDouble(Run::score).reversed().thenComparingDouble(Run::colOffset));
        return out;
    }

    // ---- public entry point -------------------------------------------------------------------------------------

    public static Advice advise(List<Seat> seats, int count, String mode, String theatreType) {
        boolean valueMode = "value".equalsIgnoreCase(mode);
        count = Math.max(1, Math.min(count, 10));
        Hall hall = parse(seats);
        int rowCount = hall.rows.size();

        Map<String, Integer> heat = new LinkedHashMap<>();
        for (char row : hall.rows) {
            int ri = hall.rowIndex(row);
            int maxCol = hall.maxCol(row);
            hall.cols.get(row).forEach((col, avail) -> {
                if (avail) heat.put("" + row + col, (int) Math.round(quality(ri, rowCount, col, maxCol)));
            });
        }

        List<String> chosen = new ArrayList<>();
        List<String> reasons = new ArrayList<>();
        List<List<String>> alternatives = new ArrayList<>();
        boolean together = true;
        double score;

        List<Run> best = runs(hall, count, valueMode, theatreType, new HashSet<>());
        if (!best.isEmpty()) {
            Run top = best.get(0);
            chosen.addAll(top.seats());
            score = top.score;
            Set<Character> usedRows = new HashSet<>();
            usedRows.add(top.row);
            for (Run r : best) {
                if (alternatives.size() >= 2) break;
                if (usedRows.contains(r.row)) continue;
                usedRows.add(r.row);
                alternatives.add(r.seats());
            }
            explain(reasons, hall, top, theatreType, valueMode, rowCount);
        } else {
            // Nowhere has `count` seats together: take the biggest groups that exist, in neighbouring rows.
            together = false;
            Set<String> taken = new HashSet<>();
            int remaining = count;
            double sum = 0;
            int n = 0;
            Character anchorRow = null;
            while (remaining > 0) {
                Run pick = null;
                for (int size = remaining; size >= 1 && pick == null; size--) {
                    List<Run> cand = runs(hall, size, valueMode, theatreType, taken);
                    if (cand.isEmpty()) continue;
                    if (anchorRow == null) {
                        pick = cand.get(0);
                    } else {
                        final int ai = hall.rowIndex(anchorRow);
                        pick = cand.stream()
                                .max(Comparator.comparingDouble(
                                        r -> r.score - 6 * Math.abs(hall.rowIndex(r.row) - ai)))
                                .orElse(null);
                    }
                }
                if (pick == null) break; // the hall simply does not have enough seats
                anchorRow = anchorRow == null ? pick.row : anchorRow;
                chosen.addAll(pick.seats());
                taken.addAll(pick.seats());
                sum += pick.score * pick.size;
                n += pick.size;
                remaining -= pick.size;
            }
            score = n == 0 ? 0 : sum / n;
            if (!chosen.isEmpty()) reasons.add("No row has " + count + " seats side by side, so this is the closest you can get");
        }

        double total = 0;
        for (String s : chosen) total += Pricing.seatPrice(theatreType, s);
        int rounded = (int) Math.max(0, Math.min(100, Math.round(score)));
        return new Advice(count, together, chosen, rounded, label(rounded, chosen.isEmpty()), reasons, alternatives,
                Math.round(total * 100.0) / 100.0, heat);
    }

    static String label(int score, boolean none) {
        if (none) return "No seats available";
        if (score >= 85) return "Prime view";
        if (score >= 70) return "Great view";
        if (score >= 50) return "Good view";
        return "Best available";
    }

    private static void explain(List<String> out, Hall hall, Run top, String theatreType, boolean valueMode, int rowCount) {
        int ri = hall.rowIndex(top.row);
        double depth = rowCount <= 1 ? IDEAL_DEPTH : (double) (rowCount - 1 - ri) / (rowCount - 1);
        int maxCol = hall.maxCol(top.row);
        if (top.colOffset <= Math.max(1.0, maxCol * 0.08)) out.add("Right in the centre of row " + top.row);
        else out.add("Row " + top.row + ", as central as the free seats allow");
        if (Math.abs(depth - IDEAL_DEPTH) <= 0.15) out.add("Best viewing depth: not too close to the screen, not too far");
        else if (depth < IDEAL_DEPTH) out.add("Closer to the screen than ideal, but the best row with seats together");
        else out.add("Further back than ideal, but the best row with seats together");
        if (top.orphans == 0) out.add("Leaves no lonely single seat beside you");
        if (top.aisle) out.add("Heads up: the aisle runs between two of these seats");
        String cls = Pricing.seatClass("" + top.row + top.from);
        out.add(cls + " · ₹" + Math.round(Pricing.seatPrice(theatreType, "" + top.row + top.from)) + " per seat"
                + (valueMode ? " (value mode weighs price against view)" : ""));
    }
}
