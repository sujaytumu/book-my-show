package com.sujaytumu.bms.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/** Lets browsers and the CDN reuse slow-changing catalogue responses for a short time (faster repeat loads). */
@Component
public class CacheHeaders extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        if ("GET".equals(req.getMethod())) {
            String p = req.getRequestURI();
            if (p.equals("/api/movies") || p.equals("/api/cities") || p.equals("/api/food") || p.equals("/api/coupons")
                    || p.equals("/api/theatres")) {
                res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
            }
        }
        chain.doFilter(req, res);
    }
}
