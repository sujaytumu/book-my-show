package com.sujaytumu.bms.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;

/**
 * Emails the PDF ticket via the Resend API (https://resend.com) after a
 * booking is confirmed. Calls Resend's REST endpoint directly (no SDK) with
 * a plain HttpClient, so there's no extra dependency for one HTTP call.
 *
 * Until a sending domain is verified in Resend, the account can only send
 * from the shared "onboarding@resend.dev" address and only to the Resend
 * account's own verified email — that's a Resend account-level restriction,
 * not something this code can work around. Once a domain is verified, only
 * RESEND_FROM_EMAIL needs to change; no code change is required.
 */
@Service
public class EmailService {

    private final String apiKey;
    private final String fromEmail;
    private final HttpClient httpClient = HttpClient.newHttpClient();

    public EmailService(@Value("${resend.api-key}") String apiKey,
                         @Value("${resend.from:onboarding@resend.dev}") String fromEmail) {
        this.apiKey = apiKey;
        this.fromEmail = fromEmail;
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    /** Best-effort: logs and returns rather than throwing, so a failed email never fails a booking. */
    public void sendTicket(String toEmail, String toName, String subject, String htmlBody, byte[] pdfBytes, String pdfFilename) {
        if (!isConfigured()) {
            return;
        }
        try {
            String base64Pdf = Base64.getEncoder().encodeToString(pdfBytes);
            String body = """
                    {
                      "from": "%s",
                      "to": ["%s"],
                      "subject": "%s",
                      "html": "%s",
                      "attachments": [{"filename": "%s", "content": "%s"}]
                    }
                    """.formatted(
                    escape(fromEmail), escape(toEmail), escape(subject), escape(htmlBody),
                    escape(pdfFilename), base64Pdf);

            HttpRequest request = HttpRequest.newBuilder(URI.create("https://api.resend.com/emails"))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 300) {
                System.err.println("Resend email failed (" + response.statusCode() + "): " + response.body());
            }
        } catch (Exception e) {
            System.err.println("Could not send ticket email: " + e.getMessage());
        }
    }

    private String escape(String s) {
        return s == null ? "" : s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n");
    }
}
