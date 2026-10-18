package com.sujaytumu.bms.controller;

import com.sujaytumu.bms.service.WaitlistService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
public class WaitlistController {

    private final WaitlistService waitlist;

    public WaitlistController(WaitlistService waitlist) {
        this.waitlist = waitlist;
    }

    @GetMapping("/api/waitlist/{showId}")
    public Map<String, Object> status(Authentication auth, @PathVariable long showId) {
        return waitlist.status(auth.getName(), showId);
    }

    @PostMapping("/api/waitlist/{showId}")
    public Map<String, Object> join(Authentication auth, @PathVariable long showId, @RequestBody Map<String, Object> body) {
        int seats = body.get("seats") instanceof Number n ? n.intValue() : 1;
        return waitlist.join(auth.getName(), showId, seats);
    }

    @DeleteMapping("/api/waitlist/{showId}")
    public Map<String, Object> leave(Authentication auth, @PathVariable long showId) {
        return waitlist.leave(auth.getName(), showId);
    }

    @GetMapping("/api/notifications")
    public List<Map<String, Object>> notifications(Authentication auth) {
        return waitlist.notifications(auth.getName());
    }
}
