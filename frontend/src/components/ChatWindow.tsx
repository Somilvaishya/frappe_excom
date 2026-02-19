import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import { BiSend, BiMicrophone, BiPlus, BiSmile } from "react-icons/bi";
import { HiOutlineDotsVertical } from "react-icons/hi";
import { FiSearch } from "react-icons/fi";
import { toast } from "sonner";
import { useMessages } from "@/hooks/useMessages";
import { WhatsAppProfile } from "@/types";
import Avatar from "./Avatar";
import MessageBubble from "./MessageBubble";
import dayjs from "dayjs";

export default function ChatWindow() {
  const { profileId } = useParams<{ profileId: string }>();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: profileData } = useFrappeGetCall<{
    message: WhatsAppProfile;
  }>(
    profileId ? "frappe.client.get" : null,
    profileId
      ? { doctype: "WhatsApp Profiles", name: profileId }
      : undefined
  );

  const profile = profileData?.message;
  const { messages, isLoading, refresh } = useMessages(profileId || "");
  const { call } = useFrappePostCall("excom.excom.api.chat.send_message");

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const interval = setInterval(() => refresh(), 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function handleSend() {
    if (!input.trim() || !profileId || sending) return;

    const text = input.trim();
    setInput("");
    setSending(true);

    try {
      await call({ profile_id: profileId, message: text });
      refresh();
    } catch (err: any) {
      toast.error(err?.message || "Failed to send message");
      setInput(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!profileId) return null;

  const displayName = profile?.profile_name || profile?.number || profileId;

  return (
    <div className="flex-1 flex flex-col h-full bg-chat-bg relative">
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-chat-header z-10 border-b border-chat-border/30">
        <div className="flex items-center gap-3">
          <Avatar name={displayName} />
          <div>
            <h2 className="text-[16px] font-normal text-white leading-tight">
              {displayName}
            </h2>
            {profile?.number && (
              <p className="text-xs text-chat-muted">{profile.number}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-2 rounded-full hover:bg-chat-hover transition-colors text-chat-muted">
            <FiSearch size={20} />
          </button>
          <button className="p-2 rounded-full hover:bg-chat-hover transition-colors text-chat-muted">
            <HiOutlineDotsVertical size={20} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-2 z-10">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-chat-muted text-sm">
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="bg-chat-panel text-chat-muted text-sm px-4 py-2 rounded-lg shadow-sm text-center">
              No messages yet. Start a conversation!
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => {
              const prevMsg = idx > 0 ? messages[idx - 1] : null;
              const showDate =
                !prevMsg ||
                !dayjs(msg.creation).isSame(dayjs(prevMsg.creation), "day");
              return (
                <MessageBubble
                  key={msg.name}
                  message={msg}
                  showDate={showDate}
                />
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 px-4 py-3 bg-chat-header z-10 border-t border-chat-border/30">
        <button className="p-2 rounded-full hover:bg-chat-hover transition-colors text-chat-muted shrink-0 mb-0.5">
          <BiPlus size={24} />
        </button>
        <button className="p-2 rounded-full hover:bg-chat-hover transition-colors text-chat-muted shrink-0 mb-0.5">
          <BiSmile size={24} />
        </button>
        <div className="flex-1 bg-chat-input rounded-xl px-4 py-2.5 flex items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message"
            className="bg-transparent text-[15px] text-white placeholder-chat-muted outline-none w-full resize-none max-h-[120px] leading-[20px]"
            rows={1}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = Math.min(target.scrollHeight, 120) + "px";
            }}
          />
        </div>
        <button
          onClick={input.trim() ? handleSend : undefined}
          disabled={sending}
          className="p-2.5 rounded-full bg-chat-accent hover:bg-emerald-600 transition-colors text-white shrink-0 mb-0.5 disabled:opacity-50"
        >
          {input.trim() ? <BiSend size={22} /> : <BiMicrophone size={22} />}
        </button>
      </div>
    </div>
  );
}
