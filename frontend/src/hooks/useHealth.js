import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client.js";

const POLL_MS = 15000;

/**
 * Polls GET /api/health. `status` is one of:
 *   "connecting" (first check pending), "online", "starting" (models warming up or index missing), "offline".
 */
export default function useHealth() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setHealth(await api.health());
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  let status = "connecting";
  if (error) status = "offline";
  else if (health) status = health.index_ready && health.models_ready ? "online" : "starting";

  return { health, status, error, refresh };
}
