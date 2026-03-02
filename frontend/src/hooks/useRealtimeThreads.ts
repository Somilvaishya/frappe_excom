import { useCallback, useEffect, useRef } from "react";
import { useFrappeEventListener } from "frappe-react-sdk";

interface ThreadUpdatedEvent {
  thread: string;
  event: "new_inbound" | "new_outbound";
}

const POLL_INTERVAL_MS = 15_000;

/**
 * Subscribes to realtime thread update events.
 * Includes a polling fallback (every 15s) so the thread list stays
 * current even if Socket.IO is temporarily unavailable.
 */
export function useRealtimeThreads(onThreadUpdate: () => void) {
  const onUpdateRef = useRef(onThreadUpdate);
  onUpdateRef.current = onThreadUpdate;

  const handler = useCallback(
    (_data: ThreadUpdatedEvent) => {
      onUpdateRef.current();
    },
    [],
  );

  useFrappeEventListener("excom:thread_updated", handler);

  useEffect(() => {
    const id = setInterval(() => {
      onUpdateRef.current();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
}
