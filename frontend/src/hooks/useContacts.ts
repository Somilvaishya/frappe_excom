import { useFrappeGetCall } from "frappe-react-sdk";
import { ExcomThread } from "@/types";

export function useThreads(search: string = "") {
  const { data, error, isLoading, mutate } = useFrappeGetCall<{
    message: ExcomThread[];
  }>("excom.excom.api.chat.get_threads", { search, limit: 100 });

  return {
    threads: data?.message ?? [],
    error,
    isLoading,
    refresh: mutate,
  };
}
