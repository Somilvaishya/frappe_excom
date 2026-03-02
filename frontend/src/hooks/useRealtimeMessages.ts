import { useCallback, useEffect, useRef } from "react";
import { useFrappeEventListener } from "frappe-react-sdk";

interface MessageReceivedEvent {
  thread: string;
  message: string;
  omni_identity: string;
  direction: "Inbound" | "Outbound";
  preview: string;
}

interface MessageStatusEvent {
  message: string;
  thread: string;
  status: string;
  provider_message_id: string;
}

const POLL_INTERVAL_MS = 10_000;

/**
 * Subscribes to realtime message events for a given thread.
 * Includes a polling fallback (every 10s) to catch events that
 * might be missed if the Socket.IO connection drops.
 */
export function useRealtimeMessages(
  threadId: string | null,
  onNewMessage: () => void,
  onStatusUpdate?: (messageId: string, status: string) => void,
) {
  const onNewMessageRef = useRef(onNewMessage);
  onNewMessageRef.current = onNewMessage;

  const handleMessageReceived = useCallback(
    (data: MessageReceivedEvent) => {
      if (!threadId || data.thread !== threadId) return;
      onNewMessageRef.current();
    },
    [threadId],
  );

  const handleMessageSent = useCallback(
    (data: MessageReceivedEvent) => {
      if (!threadId || data.thread !== threadId) return;
      onNewMessageRef.current();
    },
    [threadId],
  );

  const handleStatusUpdate = useCallback(
    (data: MessageStatusEvent) => {
      if (!threadId || data.thread !== threadId) return;
      onStatusUpdate?.(data.message, data.status);
    },
    [threadId, onStatusUpdate],
  );

  useFrappeEventListener("excom:message_received", handleMessageReceived);
  useFrappeEventListener("excom:message_sent", handleMessageSent);
  useFrappeEventListener("excom:message_status_updated", handleStatusUpdate);

  // Polling fallback: refresh messages periodically when a thread is active
  useEffect(() => {
    if (!threadId) return;
    const id = setInterval(() => {
      onNewMessageRef.current();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [threadId]);
}
