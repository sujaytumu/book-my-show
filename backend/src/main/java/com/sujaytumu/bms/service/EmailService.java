package com.sujaytumu.bms.service;

import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

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
        // Confirms at boot whether the Gmail credential actually reached the app -
        // if this ever logs blank, the env var isn't wired up server-side, full stop.
        System.out.println("[EMAIL] Startup config: gmailUsername=" +
                (gmailUsername.isBlank() ? "<BLANK - not configured>" : "'" + gmailUsername + "' (configured)") +
                ", resendConfigured=" + !resendApiKey.isBlank());
    }

    public boolean isConfigured() {
        return !gmailUsername.isBlank() || !resendApiKey.isBlank();
    }

    public void sendTicket(String toEmail, String toName, String subject, String htmlBody, byte[] pdfBytes, String pdfFilename) {
        if (!gmailUsername.isBlank()) {
            System.out.println("[EMAIL] Attempting Gmail SMTP send: from=" + gmailUsername + " to=" + toEmail);
            try {
                sendViaGmail(toEmail, subject, htmlBody, pdfBytes, pdfFilename);
                System.out.println("[EMAIL] Gmail SMTP send SUCCEEDED to=" + toEmail);
                return;
            } catch (Exception e) {
                System.err.println("[EMAIL] Gmail SMTP send FAILED to=" + toEmail + " - " + describe(e)
                        + " - trying Resend fallback");
            }
        } else {
            System.out.println("[EMAIL] Skipping Gmail (not configured), trying Resend for to=" + toEmail);
        }
        if (!resendApiKey.isBlank()) {
            sendViaResend(toEmail, subject, htmlBody, pdfBytes, pdfFilename);
        } else {
            System.err.println("[EMAIL] No email provider configured at all - ticket for " + toEmail + " was not sent.");
        }
    }

    /** Full exception chain (class + message for the exception and every cause), not just getMessage() which is often null/unhelpful for SMTP auth failures. */
    private String describe(Throwable e) {
        StringBuilder sb = new StringBuilder();
        Throwable t = e;
        while (t != null) {
            sb.append(t.getClass().getSimpleName()).append(": ").append(t.getMessage()).append(" | ");
            t = t.getCause();
        }
        return sb.toString();
    }

    private void sendViaGmail(String toEmail, String subject, String htmlBody, byte[] pdfBytes, String pdfFilename) throws Exception {
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
        helper.setFrom(gmailUsername, "Book My Show");
        helper.setTo(toEmail);
        helper.setSubject(subject);
        helper.setText(htmlBody, true);
        helper.addAttachment(pdfFilename, new ByteArrayResource(pdfBytes), "application/pdf");
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
                System.err.println("[EMAIL] Resend send FAILED to=" + toEmail + " status=" + response.statusCode() + " body=" + response.body());
            } else {
                System.out.println("[EMAIL] Resend send SUCCEEDED to=" + toEmail);
            }
        } catch (Exception e) {
            System.err.println("[EMAIL] Resend send FAILED to=" + toEmail + " - " + describe(e));
        }
    }

    private String escape(String s) {
        return s == null ? "" : s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n");
    }
}
