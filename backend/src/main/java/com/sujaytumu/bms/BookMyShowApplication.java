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
        adaptRenderStyleDatabaseUrl();
        SpringApplication.run(BookMyShowApplication.class, args);
    }

    /**
     * Render (like Heroku) injects DATABASE_URL as a URI such as
     * "postgres://user:password@host:port/dbname", but the PostgreSQL JDBC
     * driver requires "jdbc:postgresql://host:port/dbname" with the
     * credentials passed separately. If DATABASE_URL is present and not
     * already JDBC-formatted, parse it once at boot and translate it into
     * spring.datasource.{url,username,password} — this avoids having to
     * hardcode or separately store the database credentials anywhere.
     */
    private static void adaptRenderStyleDatabaseUrl() {
        String raw = System.getenv("DATABASE_URL");
        if (raw == null || raw.isBlank() || raw.startsWith("jdbc:")) {
            return;
        }
        try {
            java.net.URI uri = new java.net.URI(raw);
            String[] userInfo = uri.getUserInfo().split(":", 2);
            String jdbcUrl = "jdbc:postgresql://" + uri.getHost() + ":" + uri.getPort() + uri.getPath() + "?sslmode=require";
            System.setProperty("spring.datasource.url", jdbcUrl);
            System.setProperty("spring.datasource.username", userInfo[0]);
            if (userInfo.length > 1) {
                System.setProperty("spring.datasource.password", userInfo[1]);
            }
        } catch (Exception e) {
            System.err.println("Could not parse DATABASE_URL, falling back to configured defaults: " + e.getMessage());
        }
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
