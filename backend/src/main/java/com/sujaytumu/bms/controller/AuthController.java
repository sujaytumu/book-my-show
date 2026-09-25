package com.sujaytumu.bms.controller;

import com.sujaytumu.bms.service.UserService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class AuthController {

    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/api/auth/register")
    public Map<String, Object> register(@RequestBody Map<String, String> body) {
        return userService.register(body.get("name"), body.get("email"), body.get("password"));
    }

    @PostMapping("/api/auth/login")
    public Map<String, Object> login(@RequestBody Map<String, String> body) {
        return userService.login(body.get("email"), body.get("password"));
    }
}
