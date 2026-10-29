package com.sujaytumu.bms.service;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * "Plan my day": given the movies someone wants to watch on one day, finds back-to-back showtimes at a single cinema
 * (no walking between buildings) with a comfortable gap in between (time for food and the restroom, but not hours of
 * waiting). Tries every order of the movies and every combination of showtimes, scores each plan by total waiting
 * time (less is better) plus a penalty for finishing very late, and keeps the best couple per cinema.
 */
public final class PlanMyDay {

    private PlanMyDay() {}

    public record Slot(long id, long movieId, long theatreId, LocalTime start, LocalTime end) {
        int startMin() {
            return start.getHour() * 60 + start.getMinute();
        }

        int endMin() {
            int e = end.getHour() * 60 + end.getMinute();
            return e <= startMin() ? e + 1440 : e; // finishes after midnight
        }
    }

    public record Plan(long theatreId, List<Slot> slots, int gapMinutes, int endMinutes, int score) {}

    private static final int LATE_AFTER = 23 * 60 + 45;

    public static List<Plan> plan(List<Slot> all, List<Long> movieIds, int minGap, int maxGap, int limit) {
        List<Plan> out = new ArrayList<>();
        if (movieIds.size() < 2 || movieIds.size() > 4) return out;
        List<Long> theatres = all.stream().map(Slot::theatreId).distinct().toList();
        for (long t : theatres) {
            List<Slot> here = all.stream().filter(s -> s.theatreId() == t).toList();
            if (!movieIds.stream().allMatch(m -> here.stream().anyMatch(s -> s.movieId() == m))) continue;
            List<Plan> mine = new ArrayList<>();
            Set<String> seen = new HashSet<>();
            for (List<Long> order : permutations(movieIds)) {
                search(here, order, 0, new ArrayList<>(), minGap, maxGap, t, mine, seen);
            }
            mine.sort(Comparator.comparingInt(Plan::score).thenComparingInt(Plan::endMinutes));
            out.addAll(mine.subList(0, Math.min(2, mine.size())));
        }
        out.sort(Comparator.comparingInt(Plan::score).thenComparingInt(Plan::endMinutes));
        return out.subList(0, Math.min(limit, out.size()));
    }

    private static void search(List<Slot> here, List<Long> order, int i, List<Slot> chosen, int minGap, int maxGap,
                               long theatre, List<Plan> found, Set<String> seen) {
        if (found.size() > 400) return;
        if (i == order.size()) {
            int gaps = 0;
            for (int k = 1; k < chosen.size(); k++) gaps += chosen.get(k).startMin() - chosen.get(k - 1).endMin();
            int end = chosen.get(chosen.size() - 1).endMin();
            String key = chosen.stream().map(s -> String.valueOf(s.id())).reduce("", (a, b) -> a + "," + b);
            if (!seen.add(key)) return;
            found.add(new Plan(theatre, List.copyOf(chosen), gaps, end, gaps + (end > LATE_AFTER ? 300 : 0)));
            return;
        }
        for (Slot s : here) {
            if (s.movieId() != order.get(i)) continue;
            if (i > 0) {
                int gap = s.startMin() - chosen.get(i - 1).endMin();
                if (gap < minGap || gap > maxGap) continue;
            }
            chosen.add(s);
            search(here, order, i + 1, chosen, minGap, maxGap, theatre, found, seen);
            chosen.remove(chosen.size() - 1);
        }
    }

    private static List<List<Long>> permutations(List<Long> items) {
        List<List<Long>> res = new ArrayList<>();
        permute(new ArrayList<>(items), 0, res);
        return res;
    }

    private static void permute(List<Long> a, int k, List<List<Long>> res) {
        if (k == a.size()) {
            res.add(new ArrayList<>(a));
            return;
        }
        for (int i = k; i < a.size(); i++) {
            java.util.Collections.swap(a, k, i);
            permute(a, k + 1, res);
            java.util.Collections.swap(a, k, i);
        }
    }
}
