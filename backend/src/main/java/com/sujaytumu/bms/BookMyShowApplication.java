package com.sujaytumu.bms;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Entry point for the Book My Show API.
 *
 * The application is organised as:
 *  - security   : JWT issuing/parsing + the servlet filter that authenticates requests
 *  - config     : Spring Security filter chain + CORS configuration
 *  - controller : REST endpoints, grouped by domain (auth, catalog, bookings, payments, admin)
 *  - service    : business logic that talks to the database (seat locking, payments, etc.)
 *  - scheduler  : background job that releases expired seat holds
 *  - exception  : central error -> JSON mapping
 */
@SpringBootApplication
@EnableScheduling
public class BookMyShowApplication {

    public static void main(String[] args) {
        SpringApplication.run(BookMyShowApplication.class, args);
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Seeds a default admin account on first boot so the /api/admin/** endpoints
     * are usable immediately. Change this password before any public deployment.
     */
    @Bean
    public CommandLineRunner seedAdmin(JdbcTemplate db, PasswordEncoder encoder) {
        return args -> {
            Integer existing = db.queryForObject(
                    "select count(*) from users where email = ?", Integer.class, "admin@bms.local");
            if (existing != null && existing == 0) {
                db.update("insert into users(name,email,password,role) values(?,?,?,'ADMIN')",
                        "Admin", "admin@bms.local", encoder.encode("Admin@123"));
            }
        };
    }
}
