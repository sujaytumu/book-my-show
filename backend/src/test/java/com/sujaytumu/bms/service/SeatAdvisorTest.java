package com.sujaytumu.bms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sujaytumu.bms.service.SeatAdvisor.Advice;
import com.sujaytumu.bms.service.SeatAdvisor.Seat;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class SeatAdvisorTest {

    private static List<Seat> hall(Set<String> taken) {
        List<Seat> l = new ArrayList<>();
        for (char r = 'A'; r <= 'J'; r++)
            for (int c = 1; c <= 15; c++) l.add(new Seat("" + r + c, !taken.contains("" + r + c)));
        return l;
    }

    @Test
    void emptyHallPicksCentredSeatsInTheSweetSpot() {
        Advice a = SeatAdvisor.advise(hall(Set.of()), 2, "view", "SINGLE");
        assertTrue(a.together());
        assertEquals(List.of("E7", "E8"), a.seats());
        assertEquals("Prime view", a.label());
        assertEquals(250.0, a.total());
    }

    @Test
    void doesNotStrandASingleSeat() {
        Set<String> taken = new HashSet<>();
        for (int c = 1; c <= 6; c++) taken.add("D" + c);
        for (int c = 10; c <= 15; c++) taken.add("D" + c);
        for (int c = 1; c <= 15; c++) taken.add("E" + c);
        Advice a = SeatAdvisor.advise(hall(taken), 2, "view", "SINGLE");
        // D7-D9 are free: taking two of them would leave one orphan, so another row wins.
        assertFalse(a.seats().get(0).startsWith("D"));
    }

    @Test
    void splitsAPartyWhenNoRowHasEnoughSeatsTogether() {
        Set<String> taken = new HashSet<>();
        for (char r = 'A'; r <= 'J'; r++) for (int c = 3; c <= 15; c += 3) taken.add("" + r + c);
        Advice a = SeatAdvisor.advise(hall(taken), 4, "view", "SINGLE");
        assertFalse(a.together());
        assertEquals(4, new HashSet<>(a.seats()).size());
    }

    @Test
    void soldOutAndClamping() {
        Set<String> all = new HashSet<>();
        for (char r = 'A'; r <= 'J'; r++) for (int c = 1; c <= 15; c++) all.add("" + r + c);
        assertTrue(SeatAdvisor.advise(hall(all), 2, "view", "SINGLE").seats().isEmpty());
        assertEquals(10, SeatAdvisor.advise(hall(Set.of()), 99, "view", "SINGLE").count());
        assertEquals(1, SeatAdvisor.advise(hall(Set.of()), 0, "view", "SINGLE").count());
    }

    @Test
    void heatMapOnlyCoversFreeSeatsAndFavoursTheCentre() {
        Advice a = SeatAdvisor.advise(hall(Set.of("E8")), 2, "view", "SINGLE");
        assertFalse(a.heat().containsKey("E8"));
        assertTrue(a.heat().get("E7") > a.heat().get("J1"));
        assertTrue(a.heat().get("E7") > a.heat().get("J7"));
    }
}
