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
    private final HttpClient httpClient = HttpClient.newHttpClient();

    public PaymentService(JdbcTemplate db,
                           @Value("${razorpay.key}") String razorpayKeyId,
                           @Value("${razorpay.secret}") String razorpaySecret) {
        this.db = db;
        this.razorpayKeyId = razorpayKeyId;
        this.razorpaySecret = razorpaySecret;
    }

    public boolean isConfigured() {
        return !razorpayKeyId.isBlank() && !razorpaySecret.isBlank();
    }

    public Map<String, Object> createOrder(long bookingId, double amountRupees, String receipt) throws Exception {
        if (razorpayKeyId.isBlank() || razorpaySecret.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Razorpay keys are not configured");
        }
        long amountPaise = Math.round(amountRupees * 100);
        String body = "{\"amount\":" + amountPaise + ",\"currency\":\"INR\",\"receipt\":\"" + receipt + "\"}";
        String basicAuth = Base64.getEncoder().encodeToString(
                (razorpayKeyId + ":" + razorpaySecret).getBytes(StandardCharsets.UTF_8));

        HttpRequest request = HttpRequest.newBuilder(URI.create("https://api.razorpay.com/v1/orders"))
                .header("Authorization", "Basic " + basicAuth)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
        String responseJson = httpClient.send(request, HttpResponse.BodyHandlers.ofString()).body();

        String orderId = responseJson.replaceAll(".*\"id\"\\s*:\\s*\"([^\"]+)\".*", "$1");
        if (orderId.equals(responseJson)) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Razorpay order creation failed");
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

    public void markPaid(String orderId, String paymentId) {
        db.update("update payments set razorpay_payment_id=?,status='SUCCESS',paid_at=now() where razorpay_order_id=?",
                paymentId, orderId);
    }
}
