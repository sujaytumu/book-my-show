package com.sujaytumu.bms.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Map;

/**
 * Talks to Razorpay's REST API to create orders and verifies the HMAC-SHA256
 * signature Razorpay returns after a successful checkout, so payment
 * confirmation can never be forged client-side.
 */
@Service
public class PaymentService {

    private final JdbcTemplate db;
    private final String razorpayKeyId;
    private final String razorpaySecret;
    // Timeouts matter: without them one slow call to the gateway can hang the request until the phone gives up.
    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(java.time.Duration.ofSeconds(8)).build();

    private final String webhookSecret;
    private final com.fasterxml.jackson.databind.ObjectMapper json = new com.fasterxml.jackson.databind.ObjectMapper();

    public PaymentService(JdbcTemplate db,
                           @Value("${razorpay.key}") String razorpayKeyId,
                           @Value("${razorpay.secret}") String razorpaySecret,
                           @Value("${razorpay.webhook-secret:}") String webhookSecret) {
        this.db = db;
        // Keys pasted into the Render dashboard often carry a trailing space, a newline or quotes; any of those makes
        // the key look wrong and silently drops the app into the simulated payment, so they are cleaned here.
        this.razorpayKeyId = clean(razorpayKeyId);
        this.razorpaySecret = clean(razorpaySecret);
        this.webhookSecret = clean(webhookSecret);
    }

    private static String clean(String v) {
        if (v == null) return "";
        String s = v.strip();
        if (s.length() >= 2 && ((s.startsWith("\"") && s.endsWith("\"")) || (s.startsWith("'") && s.endsWith("'")))) {
            s = s.substring(1, s.length() - 1).strip();
        }
        return s;
    }

    /** Test-mode tools (mark a pending payment paid/failed by hand) are never allowed with a live key. */
    public boolean manualResolveAllowed() {
        return !razorpayKeyId.startsWith("rzp_live_");
    }

    /** Why the app is (not) using Razorpay: "ok", "keys_missing" or "not_test_key". Safe to show to anyone. */
    public String modeReason() {
        if (razorpayKeyId.isBlank() || razorpaySecret.isBlank()) return "keys_missing";
        if (!razorpayKeyId.startsWith("rzp_test_")) return "not_test_key";
        return "ok";
    }

    /**
     * Admin check: what the server has, and whether Razorpay accepts it (one harmless read call to Razorpay).
     * Never returns the secret; the key id is only shown in part.
     */
    public Map<String, Object> diagnose() {
        Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("keyIdSet", !razorpayKeyId.isBlank());
        out.put("secretSet", !razorpaySecret.isBlank());
        out.put("keyIdHint", razorpayKeyId.isBlank() ? "" : razorpayKeyId.substring(0, Math.min(12, razorpayKeyId.length())) + "...");
        out.put("testKey", razorpayKeyId.startsWith("rzp_test_"));
        out.put("webhookSecretSet", !webhookSecret.isBlank());
        String reason = modeReason();
        if (reason.equals("keys_missing")) {
            out.put("ok", false);
            out.put("message", "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are not set on the server, so the app uses the simulated payment "
                    + "and never opens Razorpay. Add both in Render > Environment, save, and let it redeploy.");
            return out;
        }
        if (reason.equals("not_test_key")) {
            out.put("ok", false);
            out.put("message", "The key id does not start with rzp_test_. This app only allows Razorpay test keys. Use the Test mode key pair.");
            return out;
        }
        try {
            String basic = java.util.Base64.getEncoder().encodeToString((razorpayKeyId + ":" + razorpaySecret).getBytes(StandardCharsets.UTF_8));
            HttpRequest req = HttpRequest.newBuilder(URI.create("https://api.razorpay.com/v1/orders?count=1"))
                    .header("Authorization", "Basic " + basic).timeout(java.time.Duration.ofSeconds(10)).GET().build();
            HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            out.put("httpStatus", res.statusCode());
            if (res.statusCode() == 200) {
                out.put("ok", true);
                out.put("message", "Razorpay accepted the keys. Payments open the Razorpay test checkout."
                        + (webhookSecret.isBlank() ? " (No webhook secret set: the API secret is used for webhooks.)" : ""));
            } else if (res.statusCode() == 401) {
                out.put("ok", false);
                out.put("message", "Razorpay rejected the keys (401). The key id and secret are not a matching Test mode pair, "
                        + "or the secret was regenerated. Copy both again from Razorpay > Account & Settings > API Keys (Test mode).");
            } else {
                out.put("ok", false);
                out.put("message", "Razorpay answered with HTTP " + res.statusCode() + ". Try again in a minute.");
            }
        } catch (Exception e) {
            out.put("ok", false);
            out.put("message", "Could not reach Razorpay from the server (" + e.getClass().getSimpleName() + "). Try again in a minute.");
        }
        return out;
    }

    public boolean isConfigured() {
        return !razorpayKeyId.isBlank() && !razorpaySecret.isBlank() && razorpayKeyId.startsWith("rzp_test_");
    }

    public Map<String, Object> createOrder(long bookingId, double amountRupees, String receipt) throws Exception {
        if (razorpayKeyId.isBlank() || razorpaySecret.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Razorpay keys are not configured");
        }
        // Safety: this project is test-mode only. A live key is refused so real money can never move.
        if (!razorpayKeyId.startsWith("rzp_test_")) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Only Razorpay test keys (rzp_test_) are allowed");
        }
        long amountPaise = Math.round(amountRupees * 100);

        // Retry-safe: if this booking already has an unpaid order, hand the same order back so the customer can
        // simply try the payment again (a new attempt on the same order) instead of creating duplicate orders.
        java.util.List<Map<String, Object>> existing = db.queryForList(
                "select p.razorpay_order_id, p.amount from payments p where p.booking_id=? and p.status in ('CREATED','FAILED') order by p.id desc limit 1",
                bookingId);
        // Only reuse an order for the same amount; if the total changed since, Razorpay would charge the old figure.
        if (!existing.isEmpty() && existing.get(0).get("amount") != null
                && Math.abs(((Number) existing.get(0).get("amount")).doubleValue() - amountRupees) < 0.005) {
            String orderId = (String) existing.get(0).get("razorpay_order_id");
            db.update("update payments set status='CREATED' where razorpay_order_id=? and status='FAILED'", orderId);
            return Map.of(
                    "bookingId", bookingId,
                    "orderId", orderId,
                    "amount", amountPaise,
                    "currency", "INR",
                    "keyId", razorpayKeyId);
        }
        if (!existing.isEmpty()) {
            db.update("update payments set status='CANCELLED' where booking_id=? and status in ('CREATED','FAILED')", bookingId);
        }

        String body = "{\"amount\":" + amountPaise + ",\"currency\":\"INR\",\"receipt\":\"" + receipt + "\"}";
        String basicAuth = Base64.getEncoder().encodeToString(
                (razorpayKeyId + ":" + razorpaySecret).getBytes(StandardCharsets.UTF_8));

        HttpRequest request = HttpRequest.newBuilder(URI.create("https://api.razorpay.com/v1/orders"))
                .header("Authorization", "Basic " + basicAuth)
                .header("Content-Type", "application/json")
                .timeout(java.time.Duration.ofSeconds(15))
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        // Up to 3 attempts with backoff for network errors, timeouts and 5xx/429 from the gateway.
        String orderId = null;
        String last = "no answer";
        for (int attempt = 1; attempt <= 3 && orderId == null; attempt++) {
            try {
                HttpResponse<String> resp = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                int code = resp.statusCode();
                if (code >= 500 || code == 429) {
                    last = "gateway status " + code;
                } else {
                    com.fasterxml.jackson.databind.JsonNode n = json.readTree(resp.body());
                    if (code >= 200 && code < 300 && n.hasNonNull("id")) {
                        orderId = n.get("id").asText();
                    } else {
                        // A clear "no" (bad keys, bad request): retrying will not help. Keep the reason in the server log.
                        System.err.println("Razorpay rejected order for booking " + bookingId + ": HTTP " + code + " "
                                + n.path("error").path("code").asText("") + " - " + n.path("error").path("description").asText(resp.body()));
                        throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                                "We could not start the payment. Please try again in a moment.");
                    }
                }
            } catch (java.io.IOException e) {
                last = e.getClass().getSimpleName() + ": " + e.getMessage();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Payment was interrupted, please try again");
            }
            if (orderId == null && attempt < 3) Thread.sleep(500L * attempt);
        }
        if (orderId == null) {
            System.err.println("Razorpay order failed for booking " + bookingId + " after 3 attempts (" + last + ")");
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Payment gateway is not responding, please try again");
        }

        db.update("update bookings set razorpay_order_id=? where id=?", orderId, bookingId);
        db.update("insert into payments(booking_id,razorpay_order_id,amount,status) values(?,?,?,'CREATED')",
                bookingId, orderId, amountRupees);

        return Map.of(
                "bookingId", bookingId,
                "orderId", orderId,
                "amount", amountPaise,
                "currency", "INR",
                "keyId", razorpayKeyId);
    }

    /** Verifies HMAC_SHA256(orderId + "|" + paymentId, secret) == signature, in constant time. */
    public boolean verifySignature(String orderId, String paymentId, String signature) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(razorpaySecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        String expected = HexFormat.of().formatHex(
                mac.doFinal((orderId + "|" + paymentId).getBytes(StandardCharsets.UTF_8)));
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                signature.getBytes(StandardCharsets.UTF_8));
    }

    /** HMAC_SHA256(rawBody, webhookSecret) as sent in X-Razorpay-Signature. Falls back to the API secret if no webhook secret is set. */
    public boolean verifyWebhookSignature(String rawBody, String signature) throws Exception {
        String secret = !webhookSecret.isBlank() ? webhookSecret : razorpaySecret;
        if (secret.isBlank() || signature == null) return false;
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        String expected = HexFormat.of().formatHex(mac.doFinal(rawBody.getBytes(StandardCharsets.UTF_8)));
        return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), signature.getBytes(StandardCharsets.UTF_8));
    }

    /** Returns "ok", "duplicate" or "ignored". Throws 400 on a bad signature. */
    public String handleWebhook(String rawBody, String signature, String eventId, BookingService bookings) throws Exception {
        if (!verifyWebhookSignature(rawBody, signature)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid webhook signature");
        }
        com.fasterxml.jackson.databind.JsonNode root = json.readTree(rawBody);
        String event = root.path("event").asText("");
        com.fasterxml.jackson.databind.JsonNode pay = root.path("payload").path("payment").path("entity");
        String orderId = pay.path("order_id").asText("");
        String paymentId = pay.path("id").asText("");
        String dedupeKey = (eventId != null && !eventId.isBlank()) ? eventId : event + ":" + paymentId + ":" + root.path("created_at").asText("");
        int fresh = db.update("insert into payment_events(event_id,event_type) values(?,?) on conflict (event_id) do nothing",
                dedupeKey, event);
        if (fresh == 0) return "duplicate";

        switch (event) {
            case "payment.captured", "order.paid" -> {
                if (event.equals("order.paid")) {
                    com.fasterxml.jackson.databind.JsonNode o = root.path("payload").path("order").path("entity");
                    if (orderId.isEmpty()) orderId = o.path("id").asText("");
                }
                if (orderId.isEmpty()) return "ignored";
                java.util.List<Long> ids = db.queryForList("select id from bookings where razorpay_order_id=?", Long.class, orderId);
                if (ids.isEmpty()) return "ignored";
                markPaid(orderId, paymentId);
                if (!bookings.confirmBooking(ids.get(0), paymentId)) {
                    bookings.settleLatePayment(ids.get(0), paymentId);
                }
                return "ok";
            }
            case "payment.failed" -> {
                if (orderId.isEmpty()) return "ignored";
                db.update("update payments set status='FAILED' where razorpay_order_id=? and status='CREATED'", orderId);
                return "ok";
            }
            case "refund.processed" -> {
                String refundedPayment = root.path("payload").path("refund").path("entity").path("payment_id").asText("");
                if (!refundedPayment.isEmpty()) {
                    db.update("update payments set status='REFUNDED' where razorpay_payment_id=?", refundedPayment);
                }
                return "ok";
            }
            default -> {
                return "ignored";
            }
        }
    }

    public void markPaid(String orderId, String paymentId) {
        db.update("update payments set razorpay_payment_id=?,status='SUCCESS',paid_at=now() where razorpay_order_id=?",
                paymentId, orderId);
    }
}
