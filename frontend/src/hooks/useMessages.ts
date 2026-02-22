import { useFrappeGetCall } from "frappe-react-sdk";
import { ExcomMessage } from "@/types";

export function useMessages(threadId: string) {
  const { data, error, isLoading, mutate } = useFrappeGetCall<{
    message: ExcomMessage[];
  }>(
    threadId ? "excom.excom.api.chat.get_messages" : null,
    threadId ? { thread_id: threadId, limit: 100 } : undefined
  );

  return {
    messages: data?.message ?? [],
    error,
    isLoading,
    refresh: mutate,
  };
}
