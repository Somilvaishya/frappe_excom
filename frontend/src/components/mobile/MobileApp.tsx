import { useState, useMemo } from "react";
import { MessageCircle, Phone, User } from "lucide-react";
import type { UnifiedContact } from "../../types";
import { MobileConversationList } from "./MobileConversationList";
import { MobileChannelView } from "./MobileChannelView";
import { CallScreen } from "./CallScreen";
import { MobileContactView } from "./MobileContactView";
import { MobileAIDrawer } from "./MobileAIDrawer";

type View = "list" | "conversation" | "call" | "contact";

interface MobileAppProps {
  unifiedContacts: UnifiedContact[];
}

export function MobileApp({ unifiedContacts }: MobileAppProps) {
  const [currentView, setCurrentView] = useState<View>("list");
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
      {currentView === "conversation" && selectedContact && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <MobileChannelView
            contact={selectedContact}
            onBack={() => { setCurrentView("list"); setSelectedContactEmail(null); }}
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
        <MobileAIDrawer isOpen={isAIDrawerOpen} onClose={() => setIsAIDrawerOpen(false)} onUseSuggestion={handleUseSuggestion} />
      )}

      {currentView === "list" && (
        <div className="shrink-0 bg-zinc-900 border-t border-zinc-800 safe-area-bottom">
          <div className="flex items-center justify-around h-16">
            <button className="flex flex-col items-center gap-1 px-4 py-2 text-blue-400">
              <MessageCircle className="w-6 h-6" /><span className="text-xs">Chats</span>
            </button>
            <button className="flex flex-col items-center gap-1 px-4 py-2 text-zinc-500">
              <Phone className="w-6 h-6" /><span className="text-xs">Calls</span>
            </button>
            <button className="flex flex-col items-center gap-1 px-4 py-2 text-zinc-500">
              <User className="w-6 h-6" /><span className="text-xs">Contacts</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
