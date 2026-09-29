package com.sujaytumu.bms.service;

import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * Emails the PDF ticket after a booking is confirmed.
 *
 * Primary path: Gmail SMTP (via a Gmail account + App Password). This is free
 * and, unlike Resend without a verified sending domain, works for any
 * recipient address - not just the account owner's own inbox.
 *
 * Fallback: Resend's HTTP API, used only if Gmail isn't configured. Kept as
 * a fallback rather than removed so nothing breaks if Gmail credentials are
 * ever unset.
 *
 * Both paths are best-effort: any failure is logged and swallowed, so a
 * booking never fails because of email.
 */
@Service
public class EmailService {

    private final JavaMailSender mailSender;
    private final String gmailUsername;
    private final String resendApiKey;
    private final String resendFrom;
    private final HttpClient httpClient = HttpClient.newHttpClient();

    public EmailService(JavaMailSender mailSender,
                         @Value("${spring.mail.username:}") String gmailUsername,
                         @Value("${resend.api-key}") String resendApiKey,
                         @Value("${resend.from:onboarding@resend.dev}") String resendFrom) {
        this.mailSender = mailSender;
        this.gmailUsername = gmailUsername;
        this.resendApiKey = resendApiKey;
        this.resendFrom = resendFrom;
    }

    public boolean isConfigured() {
        return !gmailUsername.isBlank() || !resendApiKey.isBlank();
    }

    public void sendTicket(String toEmail, String toName, String subject, String htmlBody, byte[] pdfBytes, String pdfFilename) {
        if (!gmailUsername.isBlank()) {
            try {
                sendViaGmail(toEmail, subject, htmlBody, pdfBytes, pdfFilename);
                return;
            } catch (Exception e) {
                System.err.println("Gmail SMTP send failed, trying Resend fallback: " + e.getMessage());
            }
        }
        if (!resendApiKey.isBlank()) {
            sendViaResend(toEmail, subject, htmlBody, pdfBytes, pdfFilename);
        }
    }

    private void sendViaGmail(String toEmail, String subject, String htmlBody, byte[] pdfBytes, String pdfFilename) throws Exception {
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
        helper.setFrom(gmailUsername, "Book My Show");
        helper.setTo(toEmail);
        helper.setSubject(subject);
        helper.setText(htmlBody, true);
        helper.addAttachment(pdfFilename, new ByteArrayInputStream(pdfBytes), "application/pdf");
        mailSender.send(message);
    }

    private void sendViaResend(String toEmail, String subject, String htmlBody, byte[] pdfBytes, String pdfFilename) {
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
                    escape(resendFrom), escape(toEmail), escape(subject), escape(htmlBody),
                    escape(pdfFilename), base64Pdf);

            HttpRequest request = HttpRequest.newBuilder(URI.create("https://api.resend.com/emails"))
                    .header("Authorization", "Bearer " + resendApiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 300) {
                System.err.println("Resend email failed (" + response.statusCode() + "): " + response.body());
            }
        } catch (Exception e) {
            System.err.println("Could not send ticket email via Resend: " + e.getMessage());
        }
    }

    private String escape(String s) {
        return s == null ? "" : s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n");
    }
}
