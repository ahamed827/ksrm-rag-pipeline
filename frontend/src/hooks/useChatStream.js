import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";

let nextId = 0;
const newId = () => `m${++nextId}`;

/**
 * Chat state with real-time streaming.
 *
 * Assistant message shape:
 *   { id, role: "assistant", text, status: "streaming"|"done"|"blocked"|"error"|"stopped",
 *     stage: "retrieving"|"generating"|null, sources: [], metrics: null, blockedReason }
 */
export default function useChatStream() {
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const controllerRef = useRef(null);

  const patch = useCallback((id, update) => {
    setMessages((list) => list.map((m) => (m.id === id ? { ...m, ...update(m) } : m)));
  }, []);

  const send = useCallback(
    async (text) => {
      const question = text.trim();
      if (!question || controllerRef.current) return;

      const assistantId = newId();
      setMessages((list) => [
        ...list,
        { id: newId(), role: "user", text: question },
        { id: assistantId, role: "assistant", text: "", status: "streaming", stage: "retrieving", sources: [], metrics: null },
      ]);

      const controller = new AbortController();
      controllerRef.current = controller;
      setStreaming(true);

      const handlers = {
        status: (d) => patch(assistantId, () => ({ stage: d.stage })),
        token: (d) => patch(assistantId, (m) => ({ text: m.text + d.text, stage: null })),
        blocked: (d) => patch(assistantId, () => ({ text: d.message, status: "blocked", blockedReason: d.reason, stage: null })),
        sources: (d) => patch(assistantId, () => ({ sources: d })),
        metrics: (d) => patch(assistantId, () => ({ metrics: d })),
        done: () => patch(assistantId, (m) => ({ status: m.status === "streaming" ? "done" : m.status, stage: null })),
        error: (d) => patch(assistantId, () => ({ text: d.message, status: "error", stage: null })),
      };

      try {
        await api.streamChat(question, (event, data) => handlers[event]?.(data), controller.signal);
        // Stream closed without a final event (e.g. server restarted mid-answer).
        patch(assistantId, (m) => (m.status === "streaming" ? { status: "done", stage: null } : {}));
      } catch (e) {
        if (e.name === "AbortError") {
          patch(assistantId, (m) => ({ status: "stopped", stage: null, text: m.text }));
        } else {
          patch(assistantId, () => ({
            status: "error",
            stage: null,
            text: "Couldn't reach the assistant. Check that the backend is running and try again.",
          }));
        }
      } finally {
        controllerRef.current = null;
        setStreaming(false);
      }
    },
    [patch]
  );

  const stop = useCallback(() => controllerRef.current?.abort(), []);

  const clear = useCallback(() => {
    controllerRef.current?.abort();
    setMessages([]);
  }, []);

  useEffect(() => () => controllerRef.current?.abort(), []);

  return { messages, streaming, send, stop, clear };
}
