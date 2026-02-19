import { useFrappeGetCall } from "frappe-react-sdk";
import { WhatsAppMessage } from "@/types";

export function useMessages(profileId: string) {
  const { data, error, isLoading, mutate } = useFrappeGetCall<{
    message: WhatsAppMessage[];
  }>(
    profileId ? "excom.excom.api.chat.get_messages" : null,
    profileId ? { profile_id: profileId, limit: 100 } : undefined
  );

  return {
    messages: data?.message ?? [],
    error,
    isLoading,
    refresh: mutate,
  };
}
