import { useMemo } from "react";
import { useFrappeGetCall } from "frappe-react-sdk";
import type { ExcomThread, UnifiedContact, Account, Message } from "../types";

/**
 * Fetches threads from the Frappe backend and transforms them into UnifiedContact
 * objects by grouping threads that share the same omni_identity.
 */
export function useThreads(search: string = "") {
  const { data, error, isLoading, mutate } = useFrappeGetCall<{
    message: ExcomThread[];
  }>("excom.excom.api.chat.get_threads", { search, limit: 100 });

  const threads = data?.message ?? [];

  const unifiedContacts: UnifiedContact[] = useMemo(() => {
    const groupedByIdentity = new Map<string, ExcomThread[]>();

    for (const thread of threads) {
      const key = thread.omni_identity || thread.name;
      if (!groupedByIdentity.has(key)) {
        groupedByIdentity.set(key, []);
      }
      groupedByIdentity.get(key)!.push(thread);
    }

    return Array.from(groupedByIdentity.entries()).map(
      ([identityId, identityThreads]) => {
        const sortedThreads = [...identityThreads].sort(
          (a, b) =>
            new Date(b.last_message_at).getTime() -
            new Date(a.last_message_at).getTime()
        );

        const latestThread = sortedThreads[0];
        const channels = [...new Set(sortedThreads.map((t) => t.channel))];
        const totalUnread = sortedThreads.reduce(
          (sum, t) => sum + (t.unread_count || 0),
          0
        );

        const allAccounts: Account[] = sortedThreads.map((t) => ({
          id: t.name,
          name: t.account || t.channel,
          identifier: t.primary_phone || t.display_name,
          channel: t.channel,
          isActive: true,
          hasAccess: true,
        }));

        const allTags = sortedThreads.flatMap((t) => t.tags || []);
        const uniqueTags = allTags.filter(
          (tag, idx, arr) => arr.findIndex((t) => t.tag === tag.tag) === idx
        );

        const contact: UnifiedContact = {
          id: identityId,
          contactName: latestThread.display_name,
          contactAvatar: "",
          contactInfo: {
            email: latestThread.primary_email || "",
            phone: latestThread.primary_phone || "",
            company: latestThread.company || "",
            erpEntity: undefined,
          },
          status: "offline",
          lastMessage: latestThread.last_message_preview || "",
          timestamp: new Date(latestThread.last_message_at),
          totalUnreadCount: totalUnread,
          aiStatus: undefined,
          assignedTo: latestThread.assigned_to
            ? {
                name: latestThread.assigned_to_name || latestThread.assigned_to,
                avatar: latestThread.assigned_to_avatar || "",
              }
            : undefined,
          allAccounts,
          activeAccountId: allAccounts[0]?.id || "",
          allMessages: [],
          channels,
          tags: uniqueTags.length > 0 ? uniqueTags : undefined,
        };

        return contact;
      }
    );
  }, [threads]);

  return {
    threads,
    unifiedContacts,
    error,
    isLoading,
    refresh: mutate,
  };
}
