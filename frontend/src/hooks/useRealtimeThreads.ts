import { useCallback } from "react";
import { useFrappeEventListener } from "frappe-react-sdk";

interface ThreadUpdatedEvent {
  thread: string;
  event: "new_inbound" | "new_outbound";
}

/**
 * Subscribes to realtime thread update events.
 * Calls onThreadUpdate whenever any thread gets a new message,
 * so the thread list can be re-ordered and unread counts refreshed.
 */
export function useRealtimeThreads(onThreadUpdate: () => void) {
  const handler = useCallback(
    (_data: ThreadUpdatedEvent) => {
      onThreadUpdate();
    },
    [onThreadUpdate],
  );

  useFrappeEventListener("excom:thread_updated", handler);
}
