const BASE = import.meta.env.VITE_API_URL ?? "";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return res.json();
}

/** Parse one SSE frame ("event: x\ndata: {...}") into { event, data }. */
function parseFrame(frame) {
  let event = "message";
  const dataLines = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  if (!dataLines.length) return null;
  return { event, data: JSON.parse(dataLines.join("\n")) };
}

/**
 * Stream an answer from POST /api/chat (Server-Sent Events over fetch, because EventSource
 * cannot send a POST body). Calls onEvent(event, data) for: status, token, blocked, sources,
 * metrics, done, error. Abort with the given AbortSignal.
 */
async function streamChat(question, onEvent, signal) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ question }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`Chat request failed (${res.status})`);

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value.replace(/\r\n/g, "\n");
    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const parsed = parseFrame(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      if (parsed) onEvent(parsed.event, parsed.data);
    }
  }
}

export const api = {
  health: () => request("/api/health"),
  streamChat,
  rebuildIndex: () => request("/api/index/rebuild", { method: "POST" }),
  vectors: (query) => request(`/api/vectors${query ? `?query=${encodeURIComponent(query)}` : ""}`),
  startEvaluation: () => request("/api/evaluate", { method: "POST" }),
  evaluationStatus: () => request("/api/evaluate"),
};
