package com.sujaytumu.bms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sujaytumu.bms.service.PlanMyDay.Plan;
import com.sujaytumu.bms.service.PlanMyDay.Slot;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;

class PlanMyDayTest {
    private static Slot s(long id, long movie, long theatre, String a, String b) {
        return new Slot(id, movie, theatre, LocalTime.parse(a), LocalTime.parse(b));
    }

    @Test
    void picksTheTightestBackToBackPlanAtOneCinema() {
        List<Slot> all = List.of(
                s(1, 10, 1, "10:00", "12:00"), s(2, 10, 1, "15:00", "17:00"),
                s(3, 20, 1, "12:30", "14:30"), s(4, 20, 1, "19:00", "21:00"));
        List<Plan> p = PlanMyDay.plan(all, List.of(10L, 20L), 15, 150, 5);
        assertEquals(1, p.size() > 0 ? 1 : 0);
        assertEquals(List.of(1L, 3L), p.get(0).slots().stream().map(Slot::id).toList());
        assertEquals(30, p.get(0).gapMinutes());
    }

    @Test
    void neverOverlapsAndRespectsMinimumGap() {
        List<Slot> all = List.of(s(1, 10, 1, "10:00", "12:00"), s(2, 20, 1, "12:05", "14:00"));
        assertTrue(PlanMyDay.plan(all, List.of(10L, 20L), 15, 150, 5).isEmpty());
    }

    @Test
    void worksInEitherOrderAndNeedsAllMoviesAtTheSameCinema() {
        List<Slot> all = List.of(s(1, 10, 1, "16:00", "18:00"), s(2, 20, 1, "13:00", "15:00"), s(3, 20, 2, "13:00", "15:00"));
        List<Plan> p = PlanMyDay.plan(all, List.of(10L, 20L), 15, 150, 5);
        assertEquals(1, p.size());
        assertEquals(List.of(2L, 1L), p.get(0).slots().stream().map(Slot::id).toList());
    }

    @Test
    void lateFinishIsPenalised() {
        List<Slot> all = List.of(
                s(1, 10, 1, "20:00", "22:00"), s(2, 20, 1, "22:30", "00:30"),
                s(3, 10, 2, "14:00", "16:00"), s(4, 20, 2, "17:00", "19:00"));
        List<Plan> p = PlanMyDay.plan(all, List.of(10L, 20L), 15, 150, 5);
        assertEquals(2L, p.get(0).theatreId());
    }
}
