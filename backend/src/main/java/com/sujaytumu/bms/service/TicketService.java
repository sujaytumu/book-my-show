package com.sujaytumu.bms.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.EnumMap;
import java.util.Map;

/**
 * Renders a booking confirmation as a single-page PDF ticket, styled after
 * BookMyShow's red/white branding: a red header band, a QR code for entry
 * scanning, and a ticket-price/convenience-fee/GST breakdown. Runs entirely
 * in-process (Apache PDFBox + ZXing, both Apache-2.0), so there's no
 * external service this depends on being up or paid for.
 */
@Service
public class TicketService {

    private static final Color BMS_RED = new Color(216, 30, 42);
    private static final Color DARK = new Color(35, 35, 35);
    private static final Color GRAY = new Color(120, 120, 120);
    private static final Color LIGHT_GRAY = new Color(235, 235, 235);
    private static final Color GREEN = new Color(30, 140, 70);

    public byte[] generateTicketPdf(Map<String, Object> booking) throws IOException {
        try (PDDocument doc = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);
            PDFont bold = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            PDFont regular = new PDType1Font(Standard14Fonts.FontName.HELVETICA);

            float pw = page.getMediaBox().getWidth();
            float ph = page.getMediaBox().getHeight();
            float margin = 40;
            float cw = pw - 2 * margin;

            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                // --- Header band ---
                float headerH = 84;
                fillRect(cs, 0, ph - headerH, pw, headerH, BMS_RED);
                drawText(cs, bold, 26, margin, ph - 42, Color.WHITE, "BOOK MY SHOW");
                drawText(cs, regular, 11, margin, ph - 62, Color.WHITE, "E-TICKET  |  BOOKING CONFIRMATION");
                String status = str(booking.get("status"));
                float sw = bold.getStringWidth(status) / 1000 * 10 + 22;
                fillRect(cs, pw - margin - sw, ph - 52, sw, 22, Color.WHITE);
                drawText(cs, bold, 10, pw - margin - sw + 11, ph - 45, "CONFIRMED".equals(status) ? GREEN : BMS_RED, status);

                float y = ph - headerH - 36;

                // --- Movie ---
                drawText(cs, bold, 22, margin, y, DARK, str(booking.get("title")));
                y -= 20;
                StringBuilder meta = new StringBuilder();
                appendMeta(meta, booking.get("show_language") != null ? booking.get("show_language") : booking.get("movie_language"));
                appendMeta(meta, booking.get("show_format"));
                appendMeta(meta, booking.get("certificate"));
                Object dur = booking.get("duration_minutes");
                if (dur instanceof Number) {
                    int mins = ((Number) dur).intValue();
                    appendMeta(meta, (mins / 60) + "h " + (mins % 60) + "m");
                }
                appendMeta(meta, booking.get("genre"));
                drawText(cs, regular, 11, margin, y, GRAY, meta.toString());
                y -= 22;

                // --- Venue box ---
                fillRect(cs, margin, y - 62, cw, 66, PANEL);
                drawText(cs, bold, 9, margin + 14, y - 14, GRAY, "VENUE");
                drawText(cs, bold, 14, margin + 14, y - 31, DARK, str(booking.get("theatre_name")));
                String addr = str(booking.get("theatre_address"));
                Object city = booking.get("city_name");
                if (city != null && !addr.contains(city.toString())) {
                    addr = addr.isEmpty() ? city.toString() : addr + ", " + city;
                }
                drawText(cs, regular, 10, margin + 14, y - 46, GRAY, fit(regular, 10, addr, cw - 28));
                y -= 92;

                // --- Date / Time / Screen / Tickets grid ---
                float colW = cw / 4;
                String[] labels = {"DATE", "SHOW TIME", "SCREEN", "TICKETS"};
                Object cnt = booking.get("seat_count");
                String[] values = {
                        prettyDate(str(booking.get("show_date"))),
                        prettyTime(str(booking.get("start_time"))),
                        str(booking.get("screen_name")),
                        cnt == null ? "" : String.valueOf(cnt)
                };
                for (int i = 0; i < 4; i++) {
                    drawText(cs, bold, 9, margin + i * colW, y, GRAY, labels[i]);
                    drawText(cs, bold, 12, margin + i * colW, y - 16, DARK, fit(bold, 12, values[i], colW - 8));
                }
                y -= 46;

                // --- Seats highlight ---
                drawText(cs, bold, 9, margin, y, GRAY, "SEATS");
                y -= 20;
                drawText(cs, bold, 18, margin, y, BMS_RED, fit(bold, 18, str(booking.get("seats")), cw));
                y -= 26;

                // --- Tear line ---
                dashedLine(cs, margin, y, cw);
                y -= 26;

                // --- QR + booking info ---
                float qrSize = 120;
                PDImageXObject qr = generateQrImage(doc, str(booking.get("reference")));
                cs.drawImage(qr, margin + cw - qrSize, y - qrSize + 14, qrSize, qrSize);
                drawText(cs, regular, 8, margin + cw - qrSize + 22, y - qrSize + 2, GRAY, "SCAN AT ENTRY");
                float iy = y;
                iy = infoRow(cs, bold, regular, margin, iy, "BOOKING ID", str(booking.get("reference")));
                iy = infoRow(cs, bold, regular, margin, iy, "BOOKED BY", str(booking.get("user_name")));
                Object phone = booking.get("contact_phone");
                if (phone != null && !phone.toString().isBlank()) {
                    iy = infoRow(cs, bold, regular, margin, iy, "PHONE", phone.toString());
                }
                Object created = booking.get("created_at");
                if (created != null) {
                    String c = created.toString();
                    iy = infoRow(cs, bold, regular, margin, iy, "BOOKED ON", c.length() >= 16 ? c.substring(0, 16).replace('T', ' ') : c);
                }
                y = Math.min(iy, y - qrSize) - 6;

                Object food = booking.get("food_summary");
                if (food != null && !food.toString().isBlank()) {
                    drawText(cs, bold, 9, margin, y, GRAY, "FOOD & BEVERAGES");
                    y -= 15;
                    drawText(cs, regular, 11, margin, y, DARK, fit(regular, 11, food.toString(), cw));
                    y -= 22;
                }

                drawDivider(cs, margin, y, cw);
                y -= 22;

                // --- Fare breakdown ---
                drawText(cs, bold, 12, margin, y, DARK, "Payment Summary");
                y -= 20;
                y = priceRow(cs, regular, margin, y, cw, "Ticket Price", booking.get("ticket_subtotal"), DARK, false);
                Object couponDiscount = booking.get("discount_amount");
                if (couponDiscount instanceof Number && ((Number) couponDiscount).doubleValue() > 0) {
                    y = priceRow(cs, regular, margin, y, cw, "Coupon " + str(booking.get("coupon_code")),
                            -((Number) couponDiscount).doubleValue(), GREEN, false);
                }
                Object foodAmount = booking.get("food_amount");
                if (foodAmount instanceof Number && ((Number) foodAmount).doubleValue() > 0) {
                    y = priceRow(cs, regular, margin, y, cw, "Food & Beverages", foodAmount, DARK, false);
                }
                y = priceRow(cs, regular, margin, y, cw, "Convenience Fee", booking.get("convenience_fee"), DARK, false);
                y = priceRow(cs, regular, margin, y, cw, "GST (18% on fee)", booking.get("gst_amount"), DARK, false);
                y -= 2;
                drawDivider(cs, margin, y, cw);
                y -= 20;
                y = priceRow(cs, bold, margin, y, cw, "Total Paid", booking.get("amount"), BMS_RED, true);

                Object contactEmail = booking.get("contact_email");
                if (contactEmail != null) {
                    drawText(cs, regular, 9, margin, y, GRAY, "Confirmation sent to: " + contactEmail);
                    y -= 14;
                }
                y -= 10;

                // --- Terms ---
                fillRect(cs, margin, y - 112, cw, 116, PANEL);
                drawText(cs, bold, 10, margin + 14, y - 16, DARK, "Important information");
                String[] terms = {
                        "Show this QR code or the booking ID at the cinema entrance.",
                        "Carry a valid photo ID. The ticket is non-transferable.",
                        "Please arrive 15 minutes before the show starts.",
                        "Outside food and beverages are not allowed inside the screen.",
                        "Cancellation and refund (to wallet) is allowed only before the show starts,",
                        "and only where the cinema permits cancellation.",
                        "For help, open Help & support in the app."
                };
                float ty = y - 32;
                for (String t : terms) {
                    drawText(cs, regular, 9, margin + 14, ty, GRAY, t);
                    ty -= 13;
                }

                fillRect(cs, 0, 0, pw, 10, BMS_RED);
                drawText(cs, regular, 8, margin, 22, GRAY, "This is a computer generated ticket and does not require a signature.");
            }

            doc.save(out);
            return out.toByteArray();
        }
    }

    private static final Color PANEL = new Color(246, 246, 248);

    private String str(Object o) {
        return safe(o == null ? "" : String.valueOf(o));
    }

    /** Standard PDF fonts only cover Latin-1; replace anything else so showText never throws. */
    private String safe(String s) {
        StringBuilder sb = new StringBuilder();
        for (char c : s.toCharArray()) {
            if (c == '\u20B9') sb.append("Rs.");
            else if (c >= 32 && c < 127) sb.append(c);
            else if (c >= 161 && c <= 255) sb.append(c);
            else sb.append(' ');
        }
        return sb.toString();
    }

    private void appendMeta(StringBuilder sb, Object v) {
        if (v == null || v.toString().isBlank()) return;
        if (sb.length() > 0) sb.append("  |  ");
        sb.append(safe(v.toString()));
    }

    private String fit(PDFont font, float size, String text, float maxWidth) throws IOException {
        String t = safe(text);
        while (t.length() > 3 && font.getStringWidth(t) / 1000 * size > maxWidth) {
            t = t.substring(0, t.length() - 4) + "...";
        }
        return t;
    }

    private String prettyDate(String d) {
        String[] mon = {"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};
        try {
            java.time.LocalDate ld = java.time.LocalDate.parse(d.substring(0, 10));
            String dow = ld.getDayOfWeek().getDisplayName(java.time.format.TextStyle.SHORT, java.util.Locale.ENGLISH);
            return dow + ", " + ld.getDayOfMonth() + " " + mon[ld.getMonthValue() - 1] + " " + ld.getYear();
        } catch (Exception e) {
            return d;
        }
    }

    private String prettyTime(String t) {
        try {
            int h = Integer.parseInt(t.substring(0, 2));
            return (h % 12 == 0 ? 12 : h % 12) + ":" + t.substring(3, 5) + (h >= 12 ? " PM" : " AM");
        } catch (Exception e) {
            return t;
        }
    }

    private float infoRow(PDPageContentStream cs, PDFont bold, PDFont regular, float x, float y,
                          String label, String value) throws IOException {
        drawText(cs, bold, 9, x, y, GRAY, label);
        drawText(cs, regular, 12, x, y - 14, DARK, value);
        return y - 32;
    }

    private void dashedLine(PDPageContentStream cs, float x, float y, float width) throws IOException {
        cs.setStrokingColor(new Color(190, 190, 190));
        cs.setLineWidth(1f);
        cs.setLineDashPattern(new float[] {4f, 4f}, 0f);
        cs.moveTo(x, y);
        cs.lineTo(x + width, y);
        cs.stroke();
        cs.setLineDashPattern(new float[] {}, 0f);
    }

    private float detailRow(PDPageContentStream cs, PDFont bold, PDFont regular, float x, float y,
                             String label, String value) throws IOException {
        drawText(cs, bold, 10, x, y, GRAY, label.toUpperCase());
        drawText(cs, regular, 12, x, y - 15, DARK, value);
        return y - 34;
    }

    private float priceRow(PDPageContentStream cs, PDFont font, float x, float y, float width,
                            String label, Object amount, Color color, boolean big) throws IOException {
        float size = big ? 13 : 11;
        drawText(cs, font, size, x, y, color, label);
        String amountText = "Rs. " + formatAmount(amount);
        float textWidth = font.getStringWidth(amountText) / 1000 * size;
        drawText(cs, font, size, x + width - textWidth, y, color, amountText);
        return y - (big ? 22 : 18);
    }

    private String formatAmount(Object amount) {
        if (amount == null) return "0.00";
        double value = ((Number) amount).doubleValue();
        return String.format("%.2f", value);
    }

    private String timeOnly(String time) {
        return time != null && time.length() >= 5 ? time.substring(0, 5) : String.valueOf(time);
    }

    private void drawText(PDPageContentStream cs, PDFont font, float size, float x, float y, Color color, String text) throws IOException {
        cs.setNonStrokingColor(color);
        cs.beginText();
        cs.setFont(font, size);
        cs.newLineAtOffset(x, y);
        cs.showText(safe(text == null ? "" : text));
        cs.endText();
    }

    private void drawDivider(PDPageContentStream cs, float x, float y, float width) throws IOException {
        cs.setStrokingColor(LIGHT_GRAY);
        cs.setLineWidth(1f);
        cs.moveTo(x, y);
        cs.lineTo(x + width, y);
        cs.stroke();
    }

    private void fillRect(PDPageContentStream cs, float x, float y, float width, float height, Color color) throws IOException {
        cs.setNonStrokingColor(color);
        cs.addRect(x, y, width, height);
        cs.fill();
    }

    private void fillRoundRect(PDPageContentStream cs, float x, float y, float width, float height, Color color) throws IOException {
        // PDFBox has no built-in rounded rect primitive on this API surface; a plain
        // filled rect reads fine at this size and keeps the drawing code simple.
        fillRect(cs, x, y, width, height, color);
    }

    private PDImageXObject generateQrImage(PDDocument doc, String content) throws IOException {
        try {
            Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
            hints.put(EncodeHintType.MARGIN, 0);
            BitMatrix matrix = new QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, 200, 200, hints);
            BufferedImage image = new BufferedImage(200, 200, BufferedImage.TYPE_INT_RGB);
            for (int px = 0; px < 200; px++) {
                for (int py = 0; py < 200; py++) {
                    image.setRGB(px, py, matrix.get(px, py) ? 0x000000 : 0xFFFFFF);
                }
            }
            return LosslessFactory.createFromImage(doc, image);
        } catch (Exception e) {
            throw new IOException("Could not generate QR code", e);
        }
    }
}
