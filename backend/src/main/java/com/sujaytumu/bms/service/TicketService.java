package com.sujaytumu.bms.service;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Map;

/**
 * Renders a booking confirmation as a single-page PDF ticket: reference code,
 * movie/theatre/show details, seats and amount. No external service is
 * involved (Apache PDFBox runs entirely in-process), so this never depends
 * on a third-party API being up or paid for.
 */
@Service
public class TicketService {

    public byte[] generateTicketPdf(Map<String, Object> booking) throws IOException {
        try (PDDocument doc = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PDPage page = new PDPage(PDRectangle.A5);
            doc.addPage(page);
            PDFont bold = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            PDFont regular = new PDType1Font(Standard14Fonts.FontName.HELVETICA);

            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                float margin = 40;
                float y = page.getMediaBox().getHeight() - 60;
                float width = page.getMediaBox().getWidth() - 2 * margin;

                y = writeLine(cs, bold, 20, margin, y, "BOOK MY SHOW");
                y = writeLine(cs, regular, 11, margin, y - 6, "E-Ticket / Booking Confirmation");

                cs.setLineWidth(0.75f);
                cs.moveTo(margin, y - 10);
                cs.lineTo(margin + width, y - 10);
                cs.stroke();
                y -= 30;

                y = writeRow(cs, bold, regular, margin, y, "Booking Ref", String.valueOf(booking.get("reference")));
                y = writeRow(cs, bold, regular, margin, y, "Movie", String.valueOf(booking.get("title")));
                y = writeRow(cs, bold, regular, margin, y, "Theatre", String.valueOf(booking.get("theatre_name")));
                y = writeRow(cs, bold, regular, margin, y, "Date", String.valueOf(booking.get("show_date")));
                y = writeRow(cs, bold, regular, margin, y, "Time", String.valueOf(booking.get("start_time")));
                y = writeRow(cs, bold, regular, margin, y, "Seats", String.valueOf(booking.get("seats")));
                y = writeRow(cs, bold, regular, margin, y, "Amount Paid", "Rs. " + booking.get("amount"));
                y = writeRow(cs, bold, regular, margin, y, "Status", String.valueOf(booking.get("status")));

                y -= 20;
                cs.moveTo(margin, y);
                cs.lineTo(margin + width, y);
                cs.stroke();
                y -= 20;
                writeLine(cs, regular, 9, margin, y,
                        "Show this booking reference at the theatre entrance. Valid ID may be required.");
            }

            doc.save(out);
            return out.toByteArray();
        }
    }

    private float writeLine(PDPageContentStream cs, PDFont font, float size, float x, float y, String text) throws IOException {
        cs.beginText();
        cs.setFont(font, size);
        cs.newLineAtOffset(x, y);
        cs.showText(text == null ? "" : text);
        cs.endText();
        return y;
    }

    private float writeRow(PDPageContentStream cs, PDFont bold, PDFont regular, float x, float y, String label, String value) throws IOException {
        writeLine(cs, bold, 11, x, y, label + ":");
        writeLine(cs, regular, 11, x + 130, y, value);
        return y - 22;
    }
}
