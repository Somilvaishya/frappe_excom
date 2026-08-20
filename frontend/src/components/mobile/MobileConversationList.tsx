import { Search, MessageCircle, Mail, Phone, Instagram, Bot, UserCheck, Settings } from "lucide-react";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import type { UnifiedContact } from "../../types";
import { useExcomBranding } from "../../hooks/useBranding";
import { Button } from "../ui/button";
import { formatServerTime } from "../../utils/datetime";

interface MobileConversationListProps {
  conversations: UnifiedContact[];
  onSelectConversation: (email: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenSettings?: () => void;
}

const CHANNEL_ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  whatsapp: MessageCircle,
  email: Mail,
  instagram: Instagram,
  calls: Phone,
};

const CHANNEL_COLOR_MAP: Record<string, string> = {
  whatsapp: "text-green-700",
  email: "text-blue-700",
  instagram: "text-pink-700",
  calls: "text-purple-700",
};

export function MobileConversationList({
  conversations,
  onSelectConversation,
  searchQuery,
  onSearchChange,
  onOpenSettings,
}: MobileConversationListProps) {
  const { branding } = useExcomBranding();
  const gFrom = branding?.logo_gradient_from ?? "#3b82f6";
  const gTo = branding?.logo_gradient_to ?? "#9333ea";

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      <div className="shrink-0 p-3 bg-gradient-to-b from-zinc-100 to-white border-b border-zinc-200">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: `linear-gradient(to bottom right, ${gFrom}, ${gTo})`,
            }}
          >
            <MessageCircle className="w-5 h-5 text-zinc-900" />
          </div>
          <div className="min-w-0 flex-1">
            {branding?.show_app_name && (
              <p className="text-[10px] font-semibold tracking-wider uppercase text-zinc-600 truncate mb-0.5">
                {branding.app_name || "Excom"}
              </p>
            )}
            <h1 className="text-lg font-semibold text-zinc-900 leading-tight">Excom</h1>
            <p className="text-xs text-zinc-600">On-the-go messaging</p>
          </div>
          {onOpenSettings && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-zinc-600 hover:text-zinc-900"
              onClick={onOpenSettings}
              aria-label="Settings"
            >
              <Settings className="w-5 h-5" />
            </Button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 h-10"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="divide-y divide-zinc-200/50">
          {conversations.map((contact) => (
            <div
              key={contact.id}
              onClick={() => onSelectConversation(contact.id)}
              className="p-3 hover:bg-zinc-50/50 active:bg-zinc-50 transition-colors cursor-pointer"
            >
              <div className="flex gap-3">
                <div className="relative flex-shrink-0">
                  {contact.contactAvatar ? (
                    <img
                      src={contact.contactAvatar}
                      alt={contact.contactName}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium">
                      {contact.contactName
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                  )}
                  <div
                    className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-zinc-200 ${
                      contact.status === "online"
                        ? "bg-green-500"
                        : contact.status === "away"
                        ? "bg-yellow-500"
                        : "bg-zinc-300"
                    }`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="font-medium text-zinc-900 truncate">
                      {contact.contactName}
                    </h3>
                    <span className="text-xs text-zinc-600 ml-2 flex-shrink-0">
                      {formatServerTime(contact.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex items-center gap-1">
                      {contact.channels.map((channel, idx) => {
                        const Icon = CHANNEL_ICON_MAP[channel] || MessageCircle;
                        return (
                          <Icon
                            key={idx}
                            className={`w-4 h-4 ${
                              CHANNEL_COLOR_MAP[channel] || "text-zinc-600"
                            }`}
                          />
                        );
                      })}
                    </div>
                    <p className="text-sm text-zinc-600 truncate flex-1">
                      {contact.lastMessage}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {contact.totalUnreadCount > 0 && (
                      <Badge className="bg-blue-500 text-white text-xs px-2 py-0 h-5">
                        {contact.totalUnreadCount}
                      </Badge>
                    )}
                    {contact.aiStatus === "active" ? (
                      <Badge className="bg-blue-500/10 text-blue-700 border-blue-500/20 border text-[10px] px-1.5 py-0 h-5">
                        <Bot className="w-2.5 h-2.5 mr-1" />
                        AI
                      </Badge>
                    ) : (
                      <Badge className="bg-green-500/10 text-green-700 border-green-500/20 border text-[10px] px-1.5 py-0 h-5">
                        <UserCheck className="w-2.5 h-2.5 mr-1" />
                        Human
                      </Badge>
                    )}
                    {contact.contactInfo.erpEntity && (
                      <Badge
                        variant="outline"
                        className="border-zinc-300 text-zinc-600 text-[10px] px-1.5 py-0 h-5"
                      >
                        {contact.contactInfo.erpEntity.type}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
