import { useState, useMemo } from "react";
import { MessageCircle, Phone, User } from "lucide-react";
import type { UnifiedContact } from "../../types";
import { MobileConversationList } from "./MobileConversationList";
import { MobileChannelView } from "./MobileChannelView";
import { CallScreen } from "./CallScreen";
import { MobileContactView } from "./MobileContactView";
import { MobileAIDrawer } from "./MobileAIDrawer";
import { MobileContactsList } from "./MobileContactsList";

type View = "list" | "conversation" | "call" | "contact" | "contacts_tab" | "calls_tab";

interface MobileAppProps {
  unifiedContacts: UnifiedContact[];
}

export function MobileApp({ unifiedContacts }: MobileAppProps) {
  const [currentView, setCurrentView] = useState<View>("list");
  const [activeTab, setActiveTab] = useState<"chats" | "calls" | "contacts">("chats");
  const [selectedContactEmail, setSelectedContactEmail] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [callType, setCallType] = useState<"voice" | "video">("voice");
  const [isAIDrawerOpen, setIsAIDrawerOpen] = useState(false);

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return unifiedContacts;
    const query = searchQuery.toLowerCase();
    return unifiedContacts.filter(
      (contact) =>
        contact.contactName.toLowerCase().includes(query) ||
        contact.lastMessage.toLowerCase().includes(query) ||
        contact.contactInfo.company?.toLowerCase().includes(query)
    );
  }, [unifiedContacts, searchQuery]);

  const selectedContact = unifiedContacts.find((contact) => contact.id === selectedContactEmail);

  const handleSelectContact = (email: string) => {
    setSelectedContactEmail(email);
    setCurrentView("conversation");
  };

  const handleCall = (type: "voice" | "video") => {
    setCallType(type);
    setCurrentView("call");
  };

  const handleUseSuggestion = (_suggestion: string) => {
    setIsAIDrawerOpen(false);
  };

  const handleTabSwitch = (tab: "chats" | "calls" | "contacts") => {
    setActiveTab(tab);
    if (tab === "chats") setCurrentView("list");
    else if (tab === "calls") setCurrentView("calls_tab");
    else setCurrentView("contacts_tab");
  };

  const isMainView = ["list", "calls_tab", "contacts_tab"].includes(currentView);

  return (
    <div className="h-full w-full bg-zinc-950 flex flex-col overflow-hidden">
      {currentView === "list" && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <MobileConversationList
            conversations={filteredContacts}
            onSelectConversation={handleSelectContact}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>
      )}

      {currentView === "calls_tab" && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="shrink-0 p-4 border-b border-zinc-800">
            <h2 className="text-lg font-semibold text-white">Calls</h2>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center px-8">
              <div className="w-16 h-16 rounded-full bg-zinc-800/50 flex items-center justify-center mx-auto mb-4">
                <Phone className="w-8 h-8 text-zinc-500" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Coming Soon</h3>
              <p className="text-sm text-zinc-400">
                Voice and video calls will be available in a future update.
              </p>
            </div>
          </div>
        </div>
      )}

      {currentView === "contacts_tab" && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <MobileContactsList
            contacts={unifiedContacts}
            onSelectContact={handleSelectContact}
          />
        </div>
      )}

      {currentView === "conversation" && selectedContact && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <MobileChannelView
            contact={selectedContact}
            onBack={() => { setCurrentView("list"); setActiveTab("chats"); setSelectedContactEmail(null); }}
            onCall={handleCall}
            onOpenContact={() => setCurrentView("contact")}
            onOpenAI={() => setIsAIDrawerOpen(true)}
          />
        </div>
      )}
      {currentView === "call" && selectedContact && (
        <CallScreen
          contact={{ name: selectedContact.contactName, avatar: selectedContact.contactAvatar, company: selectedContact.contactInfo.company }}
          callType={callType}
          onEndCall={() => setCurrentView("conversation")}
        />
      )}
      {currentView === "contact" && selectedContact && (
        <MobileContactView contact={selectedContact} onClose={() => setCurrentView("conversation")} />
      )}

      {(currentView === "conversation" || currentView === "contact") && (
        <MobileAIDrawer
          isOpen={isAIDrawerOpen}
          onClose={() => setIsAIDrawerOpen(false)}
          onUseSuggestion={handleUseSuggestion}
          threadId={selectedContact?.activeAccountId}
        />
      )}

      {/* Bottom Tab Bar */}
      {isMainView && (
        <div className="shrink-0 bg-zinc-900 border-t border-zinc-800 safe-area-bottom">
          <div className="flex items-center justify-around h-16">
            <button
              onClick={() => handleTabSwitch("chats")}
              className={`flex flex-col items-center gap-1 px-4 py-2 ${activeTab === "chats" ? "text-blue-400" : "text-zinc-500"}`}
            >
              <MessageCircle className="w-6 h-6" /><span className="text-xs">Chats</span>
            </button>
            <button
              onClick={() => handleTabSwitch("calls")}
              className={`flex flex-col items-center gap-1 px-4 py-2 ${activeTab === "calls" ? "text-blue-400" : "text-zinc-500"}`}
            >
              <Phone className="w-6 h-6" /><span className="text-xs">Calls</span>
            </button>
            <button
              onClick={() => handleTabSwitch("contacts")}
              className={`flex flex-col items-center gap-1 px-4 py-2 ${activeTab === "contacts" ? "text-blue-400" : "text-zinc-500"}`}
            >
              <User className="w-6 h-6" /><span className="text-xs">Contacts</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
