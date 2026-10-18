package com.sujaytumu.bms.service;

import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Real-time seat updates. A client opens /ws/seats and sends {"sub":<showId>}; whenever seats of that
 * show change (held, booked, released, cancelled) every subscriber receives {"show":<showId>} and re-fetches.
 */
@Component
public class SeatEvents extends TextWebSocketHandler {

    private final Map<String, Long> subscriptions = new ConcurrentHashMap<>();
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        String text = message.getPayload();
        int i = text.indexOf("\"sub\"");
        if (i < 0) return; // "ping" keep-alives and anything else are ignored
        StringBuilder digits = new StringBuilder();
        for (int k = text.indexOf(':', i) + 1; k > 0 && k < text.length(); k++) {
            char c = text.charAt(k);
            if (Character.isDigit(c)) digits.append(c);
            else if (digits.length() > 0) break;
        }
        if (digits.length() == 0 || digits.length() > 18) return;
        sessions.put(session.getId(), session);
        subscriptions.put(session.getId(), Long.parseLong(digits.toString()));
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session.getId());
        subscriptions.remove(session.getId());
    }

    /** Notify subscribers once the surrounding transaction (if any) has committed, so a re-fetch sees the new state. */
    public void publishAfterCommit(long showId) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    publish(showId);
                }
            });
        } else {
            publish(showId);
        }
    }

    public void publish(long showId) {
        TextMessage msg = new TextMessage("{\"show\":" + showId + "}");
        for (Map.Entry<String, Long> e : subscriptions.entrySet()) {
            if (e.getValue() != showId) continue;
            WebSocketSession s = sessions.get(e.getKey());
            if (s == null || !s.isOpen()) continue;
            try {
                synchronized (s) {
                    s.sendMessage(msg);
                }
            } catch (IOException | RuntimeException ex) {
                sessions.remove(e.getKey());
                subscriptions.remove(e.getKey());
            }
        }
    }

    public Set<Long> activeShows() {
        return Set.copyOf(subscriptions.values());
    }
}
