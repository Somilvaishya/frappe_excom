import { clsx } from "clsx";
import { WhatsAppMessage } from "@/types";
import dayjs from "dayjs";
import { BiCheck, BiCheckDouble } from "react-icons/bi";

interface MessageBubbleProps {
  message: WhatsAppMessage;
  showDate?: boolean;
}

function getStatusIcon(status: string) {
  switch (status?.toLowerCase()) {
    case "sent":
      return <BiCheck size={16} className="text-chat-muted" />;
    case "delivered":
      return <BiCheckDouble size={16} className="text-chat-muted" />;
    case "read":
      return <BiCheckDouble size={16} className="text-blue-400" />;
    case "failed":
      return <span className="text-red-400 text-[10px]">!</span>;
    default:
      return null;
  }
}

function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

export default function MessageBubble({
  message,
  showDate,
}: MessageBubbleProps) {
  const isOutgoing = message.type === "Outgoing";
  const time = dayjs(message.creation).format("HH:mm");
  const body = stripHtml(message.message || "");

  return (
    <>
      {showDate && (
        <div className="flex justify-center my-3">
          <span className="bg-chat-panel text-chat-muted text-xs px-3 py-1 rounded-lg shadow-sm">
            {dayjs(message.creation).format("MMMM D, YYYY")}
          </span>
        </div>
      )}
      <div
        className={clsx(
          "flex mb-1 px-[7%]",
          isOutgoing ? "justify-end" : "justify-start"
        )}
      >
        <div
          className={clsx(
            "relative max-w-[65%] rounded-lg px-3 pt-2 pb-1 shadow-sm",
            isOutgoing ? "bg-chat-outgoing" : "bg-chat-incoming"
          )}
        >
          {/* Tail */}
          <div
            className={clsx(
              "absolute top-0 w-3 h-3 overflow-hidden",
              isOutgoing ? "-right-1.5" : "-left-1.5"
            )}
          >
            <div
              className={clsx(
                "w-3 h-3 transform rotate-45",
                isOutgoing ? "bg-chat-outgoing -translate-x-1.5" : "bg-chat-incoming translate-x-1.5"
              )}
            />
          </div>

          {message.content_type === "image" && message.media_image && (
            <img
              src={message.media_image}
              alt=""
              className="rounded-md mb-1 max-w-full"
              loading="lazy"
            />
          )}

          {message.content_type === "document" && message.media_file && (
            <a
              href={message.media_file}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-black/20 rounded-md p-2 mb-1 hover:bg-black/30 transition-colors"
            >
              <span className="text-sm text-chat-accent truncate">
                {message.media_file.split("/").pop()}
              </span>
            </a>
          )}

          {body && (
            <p className="text-[14.2px] leading-[19px] text-[#e9edef] whitespace-pre-wrap break-words">
              {body}
            </p>
          )}

          <div className="flex items-center justify-end gap-1 mt-1 -mb-0.5">
            <span className="text-[11px] text-chat-muted/70">{time}</span>
            {isOutgoing && getStatusIcon(message.status)}
          </div>
        </div>
      </div>
    </>
  );
}
