import { useCallback } from "react";
import { useFrappeEventListener } from "frappe-react-sdk";
import type { Message } from "../types";

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

/**
 * Subscribes to realtime message events for a given thread.
 * Calls onNewMessage when a message arrives on the active thread,
 * and onStatusUpdate when delivery status changes.
 */
export function useRealtimeMessages(
  threadId: string | null,
  onNewMessage: () => void,
  onStatusUpdate?: (messageId: string, status: string) => void,
) {
  const handleMessageReceived = useCallback(
    (data: MessageReceivedEvent) => {
      if (!threadId || data.thread !== threadId) return;
      onNewMessage();
    },
    [threadId, onNewMessage],
  );

  const handleMessageSent = useCallback(
    (data: MessageReceivedEvent) => {
      if (!threadId || data.thread !== threadId) return;
      onNewMessage();
    },
    [threadId, onNewMessage],
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
}
