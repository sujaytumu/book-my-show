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
    private final EmailService emailService;
    private final java.security.SecureRandom random = new java.security.SecureRandom();

    public UserService(JdbcTemplate db, PasswordEncoder encoder, JwtService jwtService, EmailService emailService) {
        this.db = db;
        this.encoder = encoder;
        this.jwtService = jwtService;
        this.emailService = emailService;
    }

    /**
     * Forgot / change password step 1: emails a 6-digit code (valid 10 minutes). The reply is always the same
     * whether or not the address is registered, so it cannot be used to discover accounts.
     */
    public Map<String, Object> requestPasswordOtp(String rawEmail) {
        Map<String, Object> reply = Map.of("message", "If this email is registered, a 6-digit code has been sent to it.");
        if (rawEmail == null || rawEmail.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter your email");
        }
        String email = rawEmail.trim().toLowerCase();
        Integer exists = db.queryForObject("select count(*) from users where email=?", Integer.class, email);
        if (exists == null || exists == 0) return reply;
        Integer recent = db.queryForObject(
                "select count(*) from password_resets where email=? and sent_at > now() - interval '45 seconds'",
                Integer.class, email);
        if (recent != null && recent > 0) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Please wait a few seconds before asking for another code");
        }
        String otp = String.format("%06d", random.nextInt(1_000_000));
        db.update("delete from password_resets where email=?", email);
        db.update("insert into password_resets(email,otp_hash,expires_at) values(?,?,now() + interval '10 minutes')",
                email, encoder.encode(otp));
        final String code = otp;
        java.util.concurrent.CompletableFuture.runAsync(() -> emailService.sendSimple(email,
                "Your Book My Show verification code",
                "<p>Your verification code is <b style=\"font-size:20px;letter-spacing:3px\">" + code + "</b></p>"
                        + "<p>It is valid for 10 minutes. If you did not ask for it, you can ignore this email.</p>"));
        return reply;
    }

    /** Forgot / change password step 2: checks the code (5 tries) and sets the new password. */
    public Map<String, Object> resetPassword(String rawEmail, String otp, String newPassword) {
        if (rawEmail == null || otp == null || newPassword == null || newPassword.length() < 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter the code and a new password of at least 6 characters");
        }
        String email = rawEmail.trim().toLowerCase();
        java.util.List<Map<String, Object>> rows = db.queryForList(
                "select otp_hash, attempts, (expires_at > now()) valid from password_resets where email=?", email);
        if (rows.isEmpty() || !Boolean.TRUE.equals(rows.get(0).get("valid"))
                || ((Number) rows.get(0).get("attempts")).intValue() >= 5) {
            db.update("delete from password_resets where email=?", email);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This code has expired. Please request a new one.");
        }
        if (!encoder.matches(otp.trim(), (String) rows.get(0).get("otp_hash"))) {
            db.update("update password_resets set attempts = attempts + 1 where email=?", email);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "That code is not correct");
        }
        db.update("update users set password=? where email=?", encoder.encode(newPassword), email);
        db.update("delete from password_resets where email=?", email);
        return Map.of("message", "Password updated. You can log in with the new password.");
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

    private static String sha256(String value) {
        try {
            byte[] d = java.security.MessageDigest.getInstance("SHA-256").digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : d) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /**
     * "Save login on this device": after a successful password check, hands the device a random token
     * (only its hash is stored, valid 90 days) that can sign in again with one tap, even after logout.
     */
    public Map<String, Object> rememberDevice(String email, String password) {
        Map<String, Object> session = login(email, password); // validates the password
        byte[] raw = new byte[32];
        random.nextBytes(raw);
        String token = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        db.update("delete from device_logins where expires_at < now()");
        db.update("insert into device_logins(user_id,token_hash,expires_at) values(?,?,now() + interval '90 days')",
                session.get("id"), sha256(token));
        return Map.of("deviceToken", token, "name", session.get("name"), "email", session.get("email"));
    }

    /** One-tap login with a saved device token. */
    public Map<String, Object> deviceLogin(String token) {
        if (token == null || token.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Saved login not found");
        }
        java.util.List<Map<String, Object>> rows = db.queryForList(
                "select u.id,u.name,u.email,u.role from device_logins d join users u on u.id=d.user_id "
                        + "where d.token_hash=? and d.expires_at > now()", sha256(token.trim()));
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Saved login expired. Please log in with your password.");
        }
        Map<String, Object> user = rows.get(0);
        String jwt = jwtService.issue((String) user.get("email"), (String) user.get("role"));
        return Map.of("token", jwt, "id", user.get("id"), "name", user.get("name"),
                "email", user.get("email"), "role", user.get("role"));
    }

    public void forgetDevice(String token) {
        if (token != null && !token.isBlank()) {
            db.update("delete from device_logins where token_hash=?", sha256(token.trim()));
        }
    }

    public Map<String, Object> currentUser(String email) {
        return db.queryForMap("select id,name,email,role from users where email=?", email);
    }
}
