import { clsx } from "clsx";
import { WhatsAppProfile } from "@/types";
import Avatar from "./Avatar";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

interface ContactItemProps {
  contact: WhatsAppProfile;
  isActive: boolean;
  onClick: () => void;
}

function formatTime(dateStr: string): string {
  if (!dateStr) return "";
  const d = dayjs(dateStr);
  const now = dayjs();
  if (d.isSame(now, "day")) return d.format("HH:mm");
  if (d.isSame(now.subtract(1, "day"), "day")) return "Yesterday";
  if (d.isSame(now, "week")) return d.format("ddd");
  return d.format("DD/MM/YY");
}

export default function ContactItem({
  contact,
  isActive,
  onClick,
}: ContactItemProps) {
  const displayName = contact.profile_name || contact.number;

  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-full flex items-center gap-3 px-3 py-3 transition-colors text-left",
        isActive
          ? "bg-chat-hover"
          : "hover:bg-chat-hover/50"
      )}
    >
      <Avatar name={displayName} size="lg" />
      <div className="flex-1 min-w-0 border-b border-chat-border/30 pb-3">
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-normal text-white truncate">
            {displayName}
          </span>
          <span
            className={clsx(
              "text-xs shrink-0 ml-2",
              contact.unread_count && contact.unread_count > 0
                ? "text-chat-accent"
                : "text-chat-muted"
            )}
          >
            {formatTime(contact.last_message_time || "")}
          </span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-sm text-chat-muted truncate pr-2">
            {contact.last_message || "No messages yet"}
          </p>
          {contact.unread_count != null && contact.unread_count > 0 && (
            <span className="bg-chat-accent text-chat-bg text-[11px] font-medium rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 shrink-0">
              {contact.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
