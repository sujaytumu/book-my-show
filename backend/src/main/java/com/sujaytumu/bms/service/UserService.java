package com.sujaytumu.bms.service;

import com.sujaytumu.bms.security.JwtService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@Service
public class UserService {

    private final JdbcTemplate db;
    private final PasswordEncoder encoder;
    private final JwtService jwtService;

    public UserService(JdbcTemplate db, PasswordEncoder encoder, JwtService jwtService) {
        this.db = db;
        this.encoder = encoder;
        this.jwtService = jwtService;
    }

    public Map<String, Object> register(String name, String rawEmail, String password) {
        String email = rawEmail.toLowerCase();
        Integer count = db.queryForObject("select count(*) from users where email=?", Integer.class, email);
        if (count != null && count > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }
        db.update("insert into users(name,email,password,role) values(?,?,?,'USER')",
                name, email, encoder.encode(password));
        return login(email, password);
    }

    public Map<String, Object> login(String rawEmail, String password) {
        String email = rawEmail.toLowerCase();
        Map<String, Object> user;
        try {
            user = db.queryForMap("select id,name,email,password,role from users where email=?", email);
        } catch (org.springframework.dao.EmptyResultDataAccessException ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }
        if (!encoder.matches(password, (String) user.get("password"))) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }
        String token = jwtService.issue((String) user.get("email"), (String) user.get("role"));
        return Map.of(
                "token", token,
                "id", user.get("id"),
                "name", user.get("name"),
                "email", user.get("email"),
                "role", user.get("role"));
    }

    public Map<String, Object> currentUser(String email) {
        return db.queryForMap("select id,name,email,role from users where email=?", email);
    }
}
