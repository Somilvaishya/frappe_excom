import { useFrappeGetCall } from "frappe-react-sdk";
import { WhatsAppProfile } from "@/types";

export function useContacts(search: string = "") {
  const { data, error, isLoading, mutate } = useFrappeGetCall<{
    message: WhatsAppProfile[];
  }>("excom.excom.api.chat.get_contacts", { search, limit: 100 });

  return {
    contacts: data?.message ?? [],
    error,
    isLoading,
    refresh: mutate,
  };
}
