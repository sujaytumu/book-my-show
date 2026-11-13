package com.sujaytumu.bms.controller;

import com.sujaytumu.bms.service.PriceAlertService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/price-alerts")
public class PriceAlertController {

    private final PriceAlertService alerts;

    public PriceAlertController(PriceAlertService alerts) {
        this.alerts = alerts;
    }

    @GetMapping("/{movieId}")
    public Map<String, Object> get(Authentication auth, @PathVariable long movieId) {
        return alerts.get(auth.getName(), movieId);
    }

    @PutMapping("/{movieId}")
    public Map<String, String> set(Authentication auth, @PathVariable long movieId, @RequestBody Map<String, Object> body) {
        alerts.set(auth.getName(), movieId, ((Number) body.getOrDefault("max_price", 0)).doubleValue());
        return Map.of("status", "set");
    }

    @DeleteMapping("/{movieId}")
    public Map<String, String> remove(Authentication auth, @PathVariable long movieId) {
        alerts.remove(auth.getName(), movieId);
        return Map.of("status", "removed");
    }
}
