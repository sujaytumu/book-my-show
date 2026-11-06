package com.sujaytumu.bms.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * Sends email over Resend's HTTPS API only (no SMTP: free hosts such as Render block SMTP ports).
 * Without a verified sending domain Resend only delivers to the Resend account owner's inbox.
 * Everything is best-effort: a failure is logged and swallowed, so a booking never fails because of email.
 */
@Service
public class EmailService {

    private final String resendApiKey;
    private final String resendFrom;
    /** When set, verification codes are mailed to this address (shown with the requester's email). Needed while Resend has no verified domain: it only delivers to the Resend account owner's inbox. */
    private final String otpRedirect;
    private final HttpClient httpClient = HttpClient.newHttpClient();

    public EmailService(
                         @Value("${resend.api-key}") String resendApiKey,
                         @Value("${resend.from:onboarding@resend.dev}") String resendFrom,
                         @Value("${mail.otp-redirect:}") String otpRedirect) {
        this.otpRedirect = otpRedirect == null ? "" : otpRedirect.trim();
        this.resendApiKey = resendApiKey;
        this.resendFrom = resendFrom;
        System.out.println("[EMAIL] Startup config: Resend " + (resendApiKey.isBlank() ? "<NOT CONFIGURED - set RESEND_API_KEY>" : "configured")
                + ", from=" + resendFrom + ", otpRedirect=" + (this.otpRedirect.isBlank() ? "<none>" : this.otpRedirect));
    }

    public boolean isConfigured() {
        return !resendApiKey.isBlank();
    }

    public void sendTicket(String toEmail, String toName, String subject, String htmlBody, byte[] pdfBytes, String pdfFilename) {
        if (resendApiKey.isBlank()) {
            System.err.println("[EMAIL] RESEND_API_KEY is not set - ticket for " + toEmail + " was not sent.");
            return;
        }
        sendViaResend(toEmail, subject, htmlBody, pdfBytes, pdfFilename);
    }

    /**
     * One-time codes (forgot / change password). Goes over HTTPS via Resend first, because free hosts such as Render
     * block SMTP ports). If OTP_REDIRECT_EMAIL is set, the code is mailed there instead
     * and the body names the account it was requested for.
     */
    public void sendCode(String requestedEmail, String subject, String htmlBody) {
        String to = otpRedirect.isBlank() ? requestedEmail : otpRedirect;
        String body = otpRedirect.isBlank() ? htmlBody
                : "<p style=\"color:#666\">Requested for account: <b>" + requestedEmail + "</b></p>" + htmlBody;
        sendSimple(to, subject, body);
    }

    /** Plain HTML email without an attachment. Best-effort: Resend (HTTPS) only - no SMTP. */
    public void sendSimple(String toEmail, String subject, String htmlBody) {
        if (!resendApiKey.isBlank()) {
            try {
                String body = "{\"from\": \"" + escape(resendFrom.contains("<") ? resendFrom : "Book My Show <" + resendFrom + ">") + "\", \"to\": [\"" + escape(toEmail) + "\"], \"subject\": \""
                        + escape(subject) + "\", \"html\": \"" + escape(htmlBody) + "\"}";
                HttpRequest request = HttpRequest.newBuilder(URI.create("https://api.resend.com/emails"))
                        .header("Authorization", "Bearer " + resendApiKey)
                        .header("Content-Type", "application/json")
                        .timeout(java.time.Duration.ofSeconds(15))
                        .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                        .build();
                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() / 100 == 2) {
                    System.out.println("[EMAIL] Resend simple send OK to=" + toEmail);
                    return;
                }
                System.err.println("[EMAIL] Resend simple send REJECTED status=" + response.statusCode() + " to=" + toEmail + " body="
                        + response.body());
            } catch (Exception e) {
                System.err.println("[EMAIL] Resend simple send FAILED to=" + toEmail + " - " + describe(e));
            }
        }
        if (resendApiKey.isBlank()) {
            System.err.println("[EMAIL] RESEND_API_KEY is not set - message to " + toEmail + " was not sent.");
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
