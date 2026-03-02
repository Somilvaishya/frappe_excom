import { useState, useEffect, useRef, useCallback } from "preact/hooks";
import { sendVisitorMessage, getVisitorMessages, type ChatMessage } from "./api";

interface Props {
  sessionToken: string;
  title: string;
  color: string;
  onClose: () => void;
  onEnd: () => void;
}

export function ChatWindow({ sessionToken, title, color, onClose, onEnd }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const lastTs = useRef("");

  const poll = useCallback(async () => {
    try {
      const msgs = await getVisitorMessages(sessionToken, lastTs.current);
      if (msgs.length) {
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m.id));
          const fresh = msgs.filter((m) => !ids.has(m.id));
          if (!fresh.length) return prev;
          return [...prev, ...fresh];
        });
        lastTs.current = msgs[msgs.length - 1].timestamp;
      }
    } catch {
      /* silent */
    }
  }, [sessionToken]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [poll]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText("");
    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      direction: "outbound",
      content,
      message_type: "text",
      timestamp: new Date().toISOString(),
      sender_name: "You",
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      await sendVisitorMessage(sessionToken, content);
      await poll();
    } catch {
      /* keep optimistic */
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const fmtTime = (ts: string) => {
    try { return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
    catch { return ""; }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 16px", backgroundColor: color, color: "white",
        borderRadius: "12px 12px 0 0",
      }}>
        <span style={{ fontWeight: "600", fontSize: "15px" }}>{title}</span>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={onEnd} style={hdrBtn} title="End chat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
          <button onClick={onClose} style={hdrBtn} title="Minimize">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6" /></svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={listRef} style={{
        flex: 1, overflowY: "auto", padding: "16px", backgroundColor: "#f9fafb",
        display: "flex", flexDirection: "column", gap: "8px",
      }}>
        {messages.map((m) => {
          const isVisitor = m.direction === "outbound";
          return (
            <div key={m.id} style={{ display: "flex", justifyContent: isVisitor ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "75%", padding: "10px 14px", borderRadius: "12px",
                fontSize: "13px", lineHeight: "1.5", wordBreak: "break-word",
                backgroundColor: isVisitor ? color : "white",
                color: isVisitor ? "white" : "#1f2937",
                boxShadow: isVisitor ? "none" : "0 1px 2px rgba(0,0,0,0.06)",
              }}>
                <div>{m.content}</div>
                <div style={{ fontSize: "10px", marginTop: "4px", opacity: 0.7, textAlign: "right" }}>{fmtTime(m.timestamp)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div style={{
        display: "flex", gap: "8px", padding: "12px 16px",
        borderTop: "1px solid #e5e7eb", backgroundColor: "white",
        borderRadius: "0 0 12px 12px",
      }}>
        <input
          type="text"
          value={text}
          onInput={(e) => setText((e.target as HTMLInputElement).value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          style={{
            flex: 1, padding: "10px 14px", border: "1px solid #e5e7eb",
            borderRadius: "20px", fontSize: "13px", outline: "none",
            fontFamily: "inherit",
          }}
        />
        <button onClick={handleSend} disabled={sending || !text.trim()} style={{
          width: "38px", height: "38px", borderRadius: "50%",
          backgroundColor: text.trim() ? color : "#d1d5db",
          color: "white", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background .15s",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
        </button>
      </div>
    </div>
  );
}

const hdrBtn: Record<string, string> = {
  background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "6px",
  padding: "4px", cursor: "pointer", color: "white", display: "flex",
  alignItems: "center", justifyContent: "center",
};
