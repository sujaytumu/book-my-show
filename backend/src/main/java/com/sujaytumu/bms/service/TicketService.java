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
            PDPage page = new PDPage(PDRectangle.A5);
            doc.addPage(page);
            PDFont bold = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            PDFont regular = new PDType1Font(Standard14Fonts.FontName.HELVETICA);

            float pageWidth = page.getMediaBox().getWidth();
            float pageHeight = page.getMediaBox().getHeight();
            float margin = 36;
            float contentWidth = pageWidth - 2 * margin;

            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                // --- Red header band ---
                float headerHeight = 76;
                fillRect(cs, 0, pageHeight - headerHeight, pageWidth, headerHeight, BMS_RED);
                drawText(cs, bold, 22, margin, pageHeight - 34, Color.WHITE, "BOOK MY SHOW");
                drawText(cs, regular, 11, margin, pageHeight - 54, Color.WHITE, "E-TICKET / BOOKING CONFIRMATION");

                float y = pageHeight - headerHeight - 30;

                // --- Status badge (top-right of body) ---
                String status = String.valueOf(booking.get("status"));
                Color statusColor = "CONFIRMED".equals(status) ? GREEN : GRAY;
                float badgeWidth = bold.getStringWidth(status) / 1000 * 10 + 20;
                fillRoundRect(cs, margin + contentWidth - badgeWidth, y - 4, badgeWidth, 20, statusColor);
                drawText(cs, bold, 10, margin + contentWidth - badgeWidth + 10, y + 2, Color.WHITE, status);

                // --- Movie + theatre ---
                drawText(cs, bold, 17, margin, y, DARK, String.valueOf(booking.get("title")));
                y -= 20;
                drawText(cs, regular, 11, margin, y, GRAY, String.valueOf(booking.get("theatre_name")));
                y -= 18;
                drawDivider(cs, margin, y, contentWidth);
                y -= 26;

                // --- Two columns: details (left) + QR code (right) ---
                float qrSize = 92;
                float detailsWidth = contentWidth - qrSize - 20;
                float detailTop = y;

                y = detailRow(cs, bold, regular, margin, y, "Booking Ref", String.valueOf(booking.get("reference")));
                y = detailRow(cs, bold, regular, margin, y, "Date", String.valueOf(booking.get("show_date")));
                y = detailRow(cs, bold, regular, margin, y, "Time", timeOnly(String.valueOf(booking.get("start_time"))));
                y = detailRow(cs, bold, regular, margin, y, "Seats", String.valueOf(booking.get("seats")));
                Object phone = booking.get("contact_phone");
                if (phone != null && !phone.toString().isBlank()) {
                    y = detailRow(cs, bold, regular, margin, y, "Phone", phone.toString());
                }

                PDImageXObject qr = generateQrImage(doc, String.valueOf(booking.get("reference")));
                float qrX = margin + detailsWidth + 20;
                cs.drawImage(qr, qrX, detailTop - qrSize + 14, qrSize, qrSize);
                drawText(cs, regular, 8, qrX + 6, detailTop - qrSize, GRAY, "SCAN AT ENTRY");

                y = Math.min(y, detailTop - qrSize) - 14;
                drawDivider(cs, margin, y, contentWidth);
                y -= 22;

                // --- Price breakdown ---
                drawText(cs, bold, 11, margin, y, DARK, "Fare Breakdown");
                y -= 20;
                y = priceRow(cs, regular, margin, y, contentWidth, "Ticket Price", booking.get("ticket_subtotal"), DARK, false);
                y = priceRow(cs, regular, margin, y, contentWidth, "Convenience Fee", booking.get("convenience_fee"), DARK, false);
                y = priceRow(cs, regular, margin, y, contentWidth, "GST (18% on fee)", booking.get("gst_amount"), DARK, false);
                y -= 4;
                drawDivider(cs, margin, y, contentWidth);
                y -= 18;
                y = priceRow(cs, bold, margin, y, contentWidth, "Total Paid", booking.get("amount"), BMS_RED, true);

                // --- Contact + footer ---
                y -= 14;
                Object contactEmail = booking.get("contact_email");
                if (contactEmail != null) {
                    drawText(cs, regular, 9, margin, y, GRAY, "Sent to: " + contactEmail);
                    y -= 16;
                }
                drawDivider(cs, margin, y, contentWidth);
                y -= 16;
                drawText(cs, regular, 9, margin, y, GRAY,
                        "Please carry a valid photo ID. This ticket is non-transferable.");
                y -= 14;
                drawText(cs, regular, 9, margin, y, GRAY,
                        "Show the QR code or booking reference at the theatre entrance for scanning.");

                fillRect(cs, 0, 0, pageWidth, 8, BMS_RED);
            }

            doc.save(out);
            return out.toByteArray();
        }
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
        cs.showText(text == null ? "" : text);
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
