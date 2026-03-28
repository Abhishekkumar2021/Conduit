import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RunUpdateMessage } from "@/types/api";

export function useRunUpdates(workspaceId: string | undefined) {
  const wsRef = useRef<WebSocket | null>(null);
  const qc = useQueryClient();

  const connect = useCallback(() => {
    if (!workspaceId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const url = `${protocol}//${host}/api/v1/ws/${workspaceId}/runs`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg: RunUpdateMessage = JSON.parse(event.data);
        if (msg.type === "run.update") {
          qc.invalidateQueries({ queryKey: ["runs"] });
          qc.invalidateQueries({ queryKey: ["run", msg.data.id] });
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      // Reconnect after 5 seconds
      setTimeout(() => connect(), 5000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [workspaceId, qc]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);
}
