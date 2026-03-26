import { MessageCircle, Phone, Instagram, Mail, Radio } from "lucide-react";
import { Badge } from "./ui/badge";
import { formatDistanceToNow } from "date-fns";
import type { UnifiedContact } from "../types";

const BROADCAST_STATUS_STYLES: Record<string, string> = {
  Sent: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
  Failed: "bg-red-500/20 text-red-400 border-red-500/40",
  Queued: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  Skipped: "bg-zinc-700/30 text-zinc-400 border-zinc-600",
};

interface ChatThreadListProps {
  conversations: UnifiedContact[];
  selectedConversationId?: string;
  onSelectConversation: (id: string) => void;
}

const CHANNEL_ICONS: Record<string, React.FC<{ className?: string }>> = {
  whatsapp: MessageCircle,
  calls: Phone,
  instagram: Instagram,
  email: Mail,
};

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: "text-green-400",
  calls: "text-blue-400",
  instagram: "text-pink-400",
  email: "text-purple-400",
};

const STATUS_COLORS: Record<string, string> = {
  online: "bg-green-500",
  away: "bg-yellow-500",
  offline: "bg-zinc-600",
};

export function ChatThreadList({
  conversations,
  selectedConversationId,
  onSelectConversation,
}: ChatThreadListProps) {
  return (
    <div className="w-96 bg-zinc-900/50 border-r border-zinc-800 flex flex-col h-full shrink-0 overflow-hidden">
      <div className="shrink-0 p-4 border-b border-zinc-800">
        <h2 className="font-semibold text-white">Conversations</h2>
        <p className="text-sm text-zinc-400 mt-1">
          {conversations.length} active threads
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="divide-y divide-zinc-800">
          {conversations.map((contact) => {
            const isSelected =
              selectedConversationId ===
              contact.id + contact.activeAccountId;

            return (
              <button
                key={contact.id}
                onClick={() => onSelectConversation(contact.id)}
                className={`w-full p-4 text-left transition-all hover:bg-zinc-800/50 ${
                  isSelected
                    ? "bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-l-2 border-blue-500"
                    : ""
                }`}
              >
                <div className="flex gap-3">
                  <div className="relative flex-shrink-0">
                    {contact.contactAvatar ? (
                      <img
                        src={contact.contactAvatar}
                        alt={contact.contactName}
                        className="w-12 h-12 rounded-full object-cover ring-2 ring-zinc-700"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 ring-2 ring-zinc-700 flex items-center justify-center text-white font-medium">
                        {contact.contactName
                          .split(" ")
                          .map((w) => w[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                    )}
                    <div
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-zinc-900 ${
                        STATUS_COLORS[contact.status] || "bg-zinc-600"
                      }`}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-medium text-white truncate">
                        {contact.contactName}
                      </h3>
                      <span className="text-xs text-zinc-500 flex-shrink-0">
                        {formatDistanceToNow(contact.timestamp, {
                          addSuffix: true,
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 mb-2">
                      {contact.channels.slice(0, 3).map((channel, index) => {
                        const ChannelIcon =
                          CHANNEL_ICONS[channel] || MessageCircle;
                        return (
                          <ChannelIcon
                            key={`${channel}-${index}`}
                            className={`w-3.5 h-3.5 ${
                              CHANNEL_COLORS[channel] || "text-zinc-400"
                            }`}
                          />
                        );
                      })}
                      <span className="text-xs text-zinc-500 truncate ml-1">
                        {contact.allAccounts.length} account
                        {contact.allAccounts.length > 1 ? "s" : ""}
                      </span>
                    </div>

                    <p className="text-sm text-zinc-400 truncate mb-2">
                      {contact.lastMessage}
                    </p>

                    <div className="flex items-center gap-2 flex-wrap">
                      {contact.tags && contact.tags.length > 0 && (
                        contact.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag.tag}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                            style={{
                              backgroundColor: `${tag.color}20`,
                              color: tag.color,
                              border: `1px solid ${tag.color}40`,
                            }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: tag.color }}
                            />
                            {tag.tag_name}
                          </span>
                        ))
                      )}
                      {contact.contactInfo.erpEntity && (
                        <Badge
                          variant="outline"
                          className="text-xs border-zinc-700 text-zinc-400"
                        >
                          {contact.contactInfo.erpEntity.type}
                        </Badge>
                      )}
                      {contact.broadcastDeliveryStatus && (
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                            BROADCAST_STATUS_STYLES[contact.broadcastDeliveryStatus] || BROADCAST_STATUS_STYLES.Queued
                          }`}
                        >
                          <Radio className="w-2.5 h-2.5" />
                          {contact.broadcastDeliveryStatus}
                        </span>
                      )}
                      {contact.totalUnreadCount > 0 && (
                        <Badge className="bg-blue-500 text-white text-xs">
                          {contact.totalUnreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
