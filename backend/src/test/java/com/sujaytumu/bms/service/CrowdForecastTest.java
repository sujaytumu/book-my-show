package com.sujaytumu.bms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sujaytumu.bms.service.CrowdForecast.Forecast;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import org.junit.jupiter.api.Test;

class CrowdForecastTest {
    private static final LocalDate SAT = LocalDate.of(2026, 10, 24);
    private static final LocalDate TUE = LocalDate.of(2026, 10, 27);

    @Test
    void soldOutIsFull() {
        assertEquals("full", CrowdForecast.forecast(SAT.atTime(10, 0), SAT, LocalTime.of(19, 0), 100, 0).level());
    }

    @Test
    void noSeatsDataGivesNothing() {
        assertNull(CrowdForecast.forecast(SAT.atTime(10, 0), SAT, LocalTime.of(19, 0), 0, 0));
    }

    @Test
    void weekendEveningBusierThanWeekdayMorningWhenEmpty() {
        Forecast eve = CrowdForecast.forecast(SAT.minusDays(2).atTime(9, 0), SAT, LocalTime.of(19, 0), 100, 100);
        Forecast morn = CrowdForecast.forecast(TUE.minusDays(2).atTime(9, 0), TUE, LocalTime.of(9, 0), 100, 100);
        assertTrue(eve.projectedPercent() > morn.projectedPercent());
        assertEquals("quiet", morn.level());
    }

    @Test
    void actualSalesTakeOverNearShowtime() {
        Forecast f = CrowdForecast.forecast(TUE.atTime(18, 0), TUE, LocalTime.of(19, 0), 100, 10);
        assertEquals("rush", f.level());
        assertTrue(f.projectedPercent() >= 90);
        Forecast empty = CrowdForecast.forecast(TUE.atTime(18, 30), TUE, LocalTime.of(19, 0), 100, 95);
        assertEquals(5, empty.soldPercent());
        assertTrue(empty.projectedPercent() < 45);
    }

    @Test
    void projectionNeverBelowSoldOrAbove100() {
        Forecast f = CrowdForecast.forecast(SAT.atTime(18, 0), SAT, LocalTime.of(19, 0), 50, 2);
        assertTrue(f.projectedPercent() >= f.soldPercent() && f.projectedPercent() <= 100);
    }
}
