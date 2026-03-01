import { useMemo } from "react";
import { useFrappeGetCall } from "frappe-react-sdk";
import type { ExcomMessage, Message } from "../types";

/**
 * Fetches messages for a given thread from the Frappe backend and
 * transforms them into the Message format used by the new UI components.
 */
export function useMessages(threadId: string) {
  const { data, error, isLoading, mutate } = useFrappeGetCall<{
    message: ExcomMessage[];
  }>(
    threadId ? "excom.excom.api.chat.get_messages" : (null as unknown as string),
    threadId ? { thread_id: threadId, limit: 100 } : undefined
  );

  const rawMessages = data?.message ?? [];

  const messages: Message[] = useMemo(() => {
    return rawMessages.map((msg) => ({
      id: msg.name,
      content: msg.content_text || "",
      timestamp: new Date(msg.creation),
      sender: msg.direction === "Inbound" ? ("contact" as const) : ("user" as const),
      status: mapDeliveryStatus(msg.delivery_status),
      type: mapMessageType(msg.message_type),
      mediaUrl: msg.media_file || undefined,
      isInternal: Boolean(msg.is_internal),
      isEmail: msg.message_type === "Email",
      contentJson: msg.content_json || undefined,
      rawDirection: msg.direction,
      sentBy: msg.sender_name
        ? { name: msg.sender_name, avatar: "" }
        : undefined,
    }));
  }, [rawMessages]);

  return {
    rawMessages,
    messages,
    error,
    isLoading,
    refresh: mutate,
  };
}

function mapDeliveryStatus(
  status: string
): "sent" | "delivered" | "read" | undefined {
  const map: Record<string, "sent" | "delivered" | "read"> = {
    Sent: "sent",
    Delivered: "delivered",
    Read: "read",
  };
  return map[status] || undefined;
}

function mapMessageType(
  type: string
): "text" | "image" | "document" | "audio" | "email" | undefined {
  const map: Record<string, "text" | "image" | "document" | "audio" | "email"> = {
    Text: "text",
    Image: "image",
    Document: "document",
    Audio: "audio",
    Email: "email",
  };
  return map[type] || "text";
}
