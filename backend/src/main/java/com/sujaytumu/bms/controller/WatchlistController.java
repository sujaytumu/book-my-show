package com.sujaytumu.bms.controller;

import com.sujaytumu.bms.service.WatchlistService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/watchlist")
public class WatchlistController {

    private final WatchlistService watchlist;

    public WatchlistController(WatchlistService watchlist) {
        this.watchlist = watchlist;
    }

    @GetMapping
    public List<Map<String, Object>> list(Authentication auth) {
        return watchlist.list(auth.getName());
    }

    @PutMapping("/{movieId}")
    public Map<String, String> add(Authentication auth, @PathVariable long movieId) {
        watchlist.add(auth.getName(), movieId);
        return Map.of("status", "added");
    }

    @DeleteMapping("/{movieId}")
    public Map<String, String> remove(Authentication auth, @PathVariable long movieId) {
        watchlist.remove(auth.getName(), movieId);
        return Map.of("status", "removed");
    }
}
