import { useEffect, useRef, useState, useCallback } from "react";
import {
  MessageCircle, Phone, Instagram, Mail, Radio,
  AlertOctagon, Archive, Trash2, Loader2,
  Eye, EyeOff, Copy, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Badge } from "./ui/badge";
import { formatDistanceToNow } from "date-fns";
import { useFrappePostCall } from "frappe-react-sdk";
import { toast } from "sonner";
import type { UnifiedContact } from "../types";

const BROADCAST_STATUS_STYLES: Record<string, string> = {
  Sent: "bg-emerald-500/20 text-emerald-700 border-emerald-500/40",
  Failed: "bg-red-500/20 text-red-700 border-red-500/40",
  Queued: "bg-amber-500/20 text-amber-700 border-amber-500/40",
  Skipped: "bg-zinc-200/30 text-zinc-600 border-zinc-300",
};

interface ChatThreadListProps {
  conversations: UnifiedContact[];
  selectedConversationId?: string;
  onSelectConversation: (id: string) => void;
  onThreadAction?: (threadId: string, action: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const CHANNEL_ICONS: Record<string, React.FC<{ className?: string }>> = {
  whatsapp: MessageCircle,
  calls: Phone,
  instagram: Instagram,
  email: Mail,
};

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: "text-green-700",
  calls: "text-blue-700",
  instagram: "text-pink-700",
  email: "text-purple-700",
};

const STATUS_COLORS: Record<string, string> = {
  online: "bg-green-500",
  away: "bg-yellow-500",
  offline: "bg-zinc-300",
};

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  contact: UnifiedContact | null;
}

export function ChatThreadList({
  conversations,
  selectedConversationId,
  onSelectConversation,
  onThreadAction,
  isCollapsed = false,
  onToggleCollapse,
}: ChatThreadListProps) {
  const selectedRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false, x: 0, y: 0, contact: null,
  });

  const { call: spamCall } = useFrappePostCall("excom.excom.api.chat.mark_spam");
  const { call: archiveCall } = useFrappePostCall("excom.excom.api.chat.archive_thread");
  const { call: deleteCall } = useFrappePostCall("excom.excom.api.chat.delete_thread");
  const { call: markReadCall } = useFrappePostCall("excom.excom.api.chat.mark_read");
  const { call: markUnreadCall } = useFrappePostCall("excom.excom.api.chat.mark_unread");

  const isSystemManager = !!(window as any).frappe?.boot?.user?.roles?.includes("System Manager");

  useEffect(() => {
    if (selectedConversationId && selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedConversationId]);

  // Close context menu on outside click or scroll
  useEffect(() => {
    if (!contextMenu.visible) return;

    const handleClose = () => setContextMenu((prev) => ({ ...prev, visible: false }));
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("click", handleClose);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("scroll", handleClose, true);
    return () => {
      document.removeEventListener("click", handleClose);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("scroll", handleClose, true);
    };
  }, [contextMenu.visible]);

  const handleContextMenu = useCallback((e: React.MouseEvent, contact: UnifiedContact) => {
    e.preventDefault();
    e.stopPropagation();

    const menuWidth = 220;
    const menuHeight = 300;
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 8;
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 8;

    setContextMenu({ visible: true, x, y, contact });
  }, []);

  const handleAction = useCallback(async (
    threadId: string,
    action: "spam" | "archive" | "delete",
    callFn: (args: Record<string, string>) => Promise<unknown>,
  ) => {
    setActionLoading(`${threadId}-${action}`);
    try {
      await callFn({ thread_id: threadId });
      toast.success(
        action === "spam" ? "Marked as spam" :
        action === "archive" ? "Archived" : "Deleted"
      );
      setContextMenu((prev) => ({ ...prev, visible: false }));
      onThreadAction?.(threadId, "select_after_action");
    } catch {
      toast.error(`Failed to ${action}`);
    } finally {
      setActionLoading(null);
    }
  }, [onThreadAction]);

  const handleCopyContact = useCallback((contact: UnifiedContact) => {
    const text = contact.contactInfo.phone || contact.contactInfo.email || contact.contactName;
    navigator.clipboard.writeText(text).then(() => {
      toast.success("Copied to clipboard");
    }).catch(() => {});
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  const totalUnread = conversations.reduce((sum, c) => sum + c.totalUnreadCount, 0);

  if (isCollapsed) {
    return (
      <div className="w-12 bg-zinc-50/50 border-r border-zinc-200 flex flex-col h-full shrink-0 items-center py-2 gap-3">
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-lg hover:bg-zinc-100/60 text-zinc-600 hover:text-zinc-900 transition-colors"
          title="Expand conversation list"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        {totalUnread > 0 && (
          <span className="bg-blue-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="w-96 bg-zinc-50/50 border-r border-zinc-200 flex flex-col h-full shrink-0 overflow-hidden">
      <div className="shrink-0 p-3 border-b border-zinc-200 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-zinc-900">Conversations</h2>
          <p className="text-sm text-zinc-600 mt-1">
            {conversations.length} active threads
          </p>
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg hover:bg-zinc-100/60 text-zinc-600 hover:text-zinc-900 transition-colors"
          title="Collapse conversation list"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="divide-y divide-zinc-200">
          {conversations.map((contact) => {
            const isSelected =
              selectedConversationId ===
              contact.id + contact.activeAccountId;

            return (
              <button
                key={contact.id}
                ref={isSelected ? selectedRef : undefined}
                onClick={() => onSelectConversation(contact.id)}
                onContextMenu={(e) => handleContextMenu(e, contact)}
                className={`w-full p-3 text-left transition-all ${
                  isSelected
                    ? "bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-l-2 border-blue-500"
                    : "hover:bg-zinc-100/50"
                }`}
              >
                <div className="flex gap-3">
                  <div className="relative flex-shrink-0">
                    {contact.contactAvatar ? (
                      <img
                        src={contact.contactAvatar}
                        alt={contact.contactName}
                        className="w-12 h-12 rounded-full object-cover ring-2 ring-zinc-300"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 ring-2 ring-zinc-300 flex items-center justify-center text-white font-medium">
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
                        STATUS_COLORS[contact.status] || "bg-zinc-300"
                      }`}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-medium text-zinc-900 truncate">
                        {contact.contactName}
                      </h3>
                      <span className="text-xs text-zinc-600 flex-shrink-0">
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
                              CHANNEL_COLORS[channel] || "text-zinc-600"
                            }`}
                          />
                        );
                      })}
                      <span className="text-xs text-zinc-600 truncate ml-1">
                        {contact.allAccounts.length} account
                        {contact.allAccounts.length > 1 ? "s" : ""}
                      </span>
                    </div>

                    <p className="text-sm text-zinc-600 truncate mb-2">
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
                          className="text-xs border-zinc-300 text-zinc-600"
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

      {/* Context menu — floating at cursor position */}
      {contextMenu.visible && contextMenu.contact && (
        <div
          ref={menuRef}
          className="fixed z-[100] min-w-[200px] py-1.5 bg-zinc-100/95 border border-zinc-300/80 rounded-xl shadow-2xl shadow-black/40 backdrop-blur-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with contact name */}
          <div className="px-3 py-2 border-b border-zinc-300/50">
            <p className="text-xs font-medium text-zinc-700 truncate">
              {contextMenu.contact.contactName}
            </p>
            <p className="text-[10px] text-zinc-600 truncate">
              {contextMenu.contact.contactInfo.phone || contextMenu.contact.contactInfo.email || contextMenu.contact.channels.join(", ")}
            </p>
          </div>

          {/* Actions */}
          <div className="py-1">
            <ContextMenuItem
              icon={contextMenu.contact.totalUnreadCount > 0
                ? <EyeOff className="w-3.5 h-3.5" />
                : <Eye className="w-3.5 h-3.5" />
              }
              label={contextMenu.contact.totalUnreadCount > 0 ? "Mark as read" : "Mark as unread"}
              loading={actionLoading === `${contextMenu.contact.activeAccountId}-read`}
              onClick={async () => {
                const threadId = contextMenu.contact!.activeAccountId;
                const isUnread = contextMenu.contact!.totalUnreadCount > 0;
                setActionLoading(`${threadId}-read`);
                try {
                  if (isUnread) {
                    await markReadCall({ thread_id: threadId });
                    toast.success("Marked as read");
                  } else {
                    await markUnreadCall({ thread_id: threadId });
                    toast.success("Marked as unread");
                  }
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                  onThreadAction?.(threadId, "read_toggled");
                } catch {
                  toast.error("Failed to update");
                } finally {
                  setActionLoading(null);
                }
              }}
            />
            <ContextMenuItem
              icon={<Copy className="w-3.5 h-3.5" />}
              label="Copy contact"
              onClick={() => handleCopyContact(contextMenu.contact!)}
            />
          </div>

          <div className="h-px bg-zinc-200/50 mx-2" />

          <div className="py-1">
            <ContextMenuItem
              icon={<AlertOctagon className="w-3.5 h-3.5" />}
              label="Mark as spam"
              className="text-amber-700 hover:bg-amber-500/10"
              loading={actionLoading === `${contextMenu.contact.activeAccountId}-spam`}
              onClick={() =>
                handleAction(contextMenu.contact!.activeAccountId, "spam", spamCall)
              }
            />
            <ContextMenuItem
              icon={<Archive className="w-3.5 h-3.5" />}
              label="Archive"
              className="text-blue-700 hover:bg-blue-500/10"
              loading={actionLoading === `${contextMenu.contact.activeAccountId}-archive`}
              onClick={() =>
                handleAction(contextMenu.contact!.activeAccountId, "archive", archiveCall)
              }
            />
            {isSystemManager && (
              <ContextMenuItem
                icon={<Trash2 className="w-3.5 h-3.5" />}
                label="Delete"
                className="text-red-700 hover:bg-red-500/10"
                loading={actionLoading === `${contextMenu.contact.activeAccountId}-delete`}
                onClick={() =>
                  handleAction(contextMenu.contact!.activeAccountId, "delete", deleteCall)
                }
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ContextMenuItem({
  icon,
  label,
  onClick,
  className = "",
  loading = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors disabled:opacity-60 ${
        className || "text-zinc-700 hover:bg-zinc-200/60 hover:text-zinc-900"
      }`}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      <span>{label}</span>
    </button>
  );
}
