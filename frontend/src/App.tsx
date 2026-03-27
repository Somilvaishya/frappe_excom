import { useState, useMemo, useEffect, useCallback } from "react";
import { FrappeProvider } from "frappe-react-sdk";
import { Toaster } from "sonner";
import { LeftSidebar } from "./components/LeftSidebar";
import { ChatThreadList } from "./components/ChatThreadList";
import { ChannelTabsView } from "./components/ChannelTabsView";
import { OmniIdentityPanel } from "./components/OmniIdentityPanel";
import { AIAssistantDrawer } from "./components/AIAssistantDrawer";
import { MobileApp } from "./components/mobile/MobileApp";
import { SubscriberListPage } from "./components/SubscriberListPage";
import { TeamManagementPage } from "./components/TeamManagementPage";
import { MergeSuggestionsPage } from "./components/MergeSuggestionsPage";
import { SubscriberRulesPage } from "./components/SubscriberRulesPage";
import { BroadcastPage } from "./components/BroadcastPage";
import { NewConversationDialog } from "./components/NewConversationDialog";
import { useThreads } from "./hooks/useContacts";
import { useRealtimeThreads } from "./hooks/useRealtimeThreads";
import { useNotifications } from "./hooks/useNotifications";
import type { UnifiedContact, Conversation } from "./types";

type AppPage = "inbox" | "subscribers" | "teams" | "merge_suggestions" | "subscriber_rules" | "broadcasts";

const getSiteName = (): string => {
  // Priority: frappe boot → env var → current hostname
  const fromBoot = (window as any).frappe?.boot?.sitename;
  if (fromBoot) return fromBoot;

  const fromEnv = import.meta.env.VITE_SITE_NAME;
  if (fromEnv) return fromEnv;

  return window.location.hostname;
};

const getSocketPort = (): string | undefined => {
  const fromEnv = import.meta.env.VITE_SOCKET_PORT;
  if (fromEnv) return String(fromEnv);

  const fromBoot = (window as any).frappe?.boot?.socketio_port;
  if (fromBoot != null) return String(fromBoot);

  return undefined;
};

function ExcomDashboard() {
  const [currentPage, setCurrentPage] = useState<AppPage>("inbox");
  const [selectedChannel, setSelectedChannel] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    null
  );
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null
  );
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState("");
  const [selectedBroadcast, setSelectedBroadcast] = useState("");
  const [selectedBroadcastStatus, setSelectedBroadcastStatus] = useState("");
  const [showNewConversation, setShowNewConversation] = useState(false);

  const { unifiedContacts, refresh: refreshThreads } = useThreads(
    searchQuery, selectedTeamFilter, selectedBroadcast, selectedBroadcastStatus,
  );

  const handleThreadUpdate = useCallback(() => {
    refreshThreads();
  }, [refreshThreads]);
  useRealtimeThreads(handleThreadUpdate);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const filteredContacts = useMemo(() => {
    return unifiedContacts.filter((contact) => {
      const matchesChannel =
        selectedChannel === "all" ||
        contact.channels.includes(selectedChannel);
      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.every((tagName) =>
          contact.tags?.some((t) => t.tag === tagName)
        );
      return matchesChannel && matchesTags;
    });
  }, [unifiedContacts, selectedChannel, selectedTags]);

  const channelCounts = useMemo(() => {
    const totalUnread = unifiedContacts.reduce(
      (sum, contact) => sum + contact.totalUnreadCount,
      0
    );
    return {
      totalConversations: filteredContacts.length,
      totalUnread,
    };
  }, [filteredContacts, unifiedContacts]);

  useNotifications(channelCounts.totalUnread);

  const selectedContact = unifiedContacts.find(
    (contact) => contact.id === selectedContactId
  );

  const unifiedConversation: Conversation | null = selectedContact
    ? {
        id: selectedContact.id,
        contactName: selectedContact.contactName,
        contactAvatar: selectedContact.contactAvatar,
        channel: selectedContact.channels[0],
        lastMessage: selectedContact.lastMessage,
        timestamp: selectedContact.timestamp,
        unreadCount: selectedContact.totalUnreadCount,
        status: selectedContact.status,
        aiStatus: selectedContact.aiStatus,
        assignedTo: selectedContact.assignedTo,
        contactInfo: selectedContact.contactInfo,
        activeAccount:
          selectedContact.allAccounts.find(
            (acc) => acc.id === selectedAccountId
          ) || selectedContact.allAccounts[0],
        otherAccounts: selectedContact.allAccounts.filter(
          (acc) => acc.id !== (selectedAccountId || selectedContact.activeAccountId)
        ),
        messages: selectedContact.allMessages,
        hiddenMessageCount: 0,
      }
    : null;

  const handleAccountSwitch = (accountId: string) => {
    setSelectedAccountId(accountId);
  };

  const handleContactSelection = (contactId: string) => {
    setSelectedContactId(contactId);
    const contact = unifiedContacts.find((c) => c.id === contactId);
    if (contact) {
      setSelectedAccountId(contact.activeAccountId);
    }
  };

  const handleNewConversationCreated = useCallback(
    (threadId: string, identityName: string) => {
      setShowNewConversation(false);
      setSelectedTeamFilter("");
      setSelectedChannel("all");
      setSelectedContactId(identityName);
      setSelectedAccountId(threadId);
      refreshThreads();
    },
    [refreshThreads]
  );

  if (isMobile) {
    return <MobileApp unifiedContacts={unifiedContacts} />;
  }

  if (currentPage === "subscribers") {
    return (
      <SubscriberListPage
        onNavigateBack={() => setCurrentPage("inbox")}
        onNavigateToBroadcasts={() => setCurrentPage("broadcasts")}
      />
    );
  }

  if (currentPage === "teams") {
    return (
      <TeamManagementPage onNavigateBack={() => setCurrentPage("inbox")} />
    );
  }

  if (currentPage === "merge_suggestions") {
    return (
      <MergeSuggestionsPage onNavigateBack={() => setCurrentPage("inbox")} />
    );
  }

  if (currentPage === "subscriber_rules") {
    return (
      <SubscriberRulesPage onNavigateBack={() => setCurrentPage("inbox")} />
    );
  }

  if (currentPage === "broadcasts") {
    return (
      <BroadcastPage onNavigateBack={() => setCurrentPage("inbox")} />
    );
  }

  return (
    <div className="h-full w-full bg-zinc-950 flex overflow-hidden">
      <LeftSidebar
        selectedChannel={selectedChannel}
        onChannelSelect={setSelectedChannel}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        totalConversations={channelCounts.totalConversations}
        totalUnread={channelCounts.totalUnread}
        selectedTags={selectedTags}
        onTagFilterChange={setSelectedTags}
        onNavigateToSubscribers={() => setCurrentPage("subscribers")}
        onNavigateToTeams={() => setCurrentPage("teams")}
        onNavigateToMergeSuggestions={() => setCurrentPage("merge_suggestions")}
        onNavigateToSubscriberRules={() => setCurrentPage("subscriber_rules")}
        onNavigateToBroadcasts={() => setCurrentPage("broadcasts")}
        selectedTeamFilter={selectedTeamFilter}
        onTeamFilterChange={setSelectedTeamFilter}
        selectedBroadcast={selectedBroadcast}
        onBroadcastFilterChange={setSelectedBroadcast}
        selectedBroadcastStatus={selectedBroadcastStatus}
        onBroadcastStatusChange={setSelectedBroadcastStatus}
        onNewConversation={() => setShowNewConversation(true)}
      />

      <ChatThreadList
        conversations={filteredContacts}
        selectedConversationId={
          selectedContactId
            ? selectedContactId + (selectedAccountId || "")
            : undefined
        }
        onSelectConversation={handleContactSelection}
      />

      {selectedContact ? (
        <>
          <ChannelTabsView
            contact={selectedContact}
            onOpenAIAssistant={() => setIsAIAssistantOpen(true)}
            activeAccountId={selectedAccountId || selectedContact.activeAccountId}
            onAccountSwitch={handleAccountSwitch}
          />

          {!isAIAssistantOpen && unifiedConversation && (
            <OmniIdentityPanel
              conversation={unifiedConversation}
              onAccountSwitch={handleAccountSwitch}
            />
          )}

          <AIAssistantDrawer
            isOpen={isAIAssistantOpen}
            onClose={() => setIsAIAssistantOpen(false)}
            contactName={selectedContact.contactName}
            threadId={selectedAccountId || selectedContact.activeAccountId}
          />
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-zinc-950">
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-10 h-10 text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Excom Chat
            </h2>
            <p className="text-zinc-400 text-sm max-w-sm mb-4">
              Select a conversation from the list to start messaging. All your
              channels are unified in one place.
            </p>
            <button
              onClick={() => setShowNewConversation(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New Conversation
            </button>
          </div>
        </div>
      )}

      {showNewConversation && (
        <NewConversationDialog
          onClose={() => setShowNewConversation(false)}
          onConversationCreated={handleNewConversationCreated}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <FrappeProvider
      url={import.meta.env.VITE_FRAPPE_PATH ?? ""}
      socketPort={getSocketPort()}
      siteName={getSiteName()}
    >
      <Toaster
        richColors
        position="top-right"
        toastOptions={{
          style: {
            background: "#27272a",
            border: "1px solid #3f3f46",
            color: "#fafafa",
          },
        }}
      />
      <ExcomDashboard />
    </FrappeProvider>
  );
}

export default App;
