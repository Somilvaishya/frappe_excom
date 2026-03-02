import { render, type ComponentChild } from "preact";
import { useState, useEffect } from "preact/hooks";
import { setSiteUrl, getConfig, createSession, endSession, type WidgetConfig } from "./api";
import { PreChatForm } from "./PreChatForm";
import { ChatWindow } from "./ChatWindow";

type View = "button" | "prechat" | "chat";

function Widget({ accountId, siteUrl }: { accountId: string; siteUrl: string }) {
  const [cfg, setCfg] = useState<WidgetConfig | null>(null);
  const [view, setView] = useState<View>("button");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState("");

  const storageKey = `excom_session_${accountId}`;

  useEffect(() => {
    setSiteUrl(siteUrl);
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      setToken(saved);
      setView("chat");
    }
    getConfig(accountId).then(setCfg).catch(() => setError("Failed to load config"));
  }, [accountId, siteUrl]);

  const color = cfg?.color || "#2563eb";
  const title = cfg?.title || "Chat with us";
  const fields = cfg?.prechat_fields ? cfg.prechat_fields.split(",").map((f) => f.trim()) : ["name", "email"];
  const isRight = cfg?.position !== "bottom-left";

  const handlePreChatSubmit = async (data: { name: string; email: string; phone: string }) => {
    try {
      const res = await createSession(accountId, data.name, data.email, data.phone, location.href);
      setToken(res.session_token);
      localStorage.setItem(storageKey, res.session_token);
      setView("chat");
    } catch {
      setError("Could not start session");
    }
  };

  const handleEnd = async () => {
    if (token) {
      try { await endSession(token); } catch { /* ignore */ }
    }
    localStorage.removeItem(storageKey);
    setToken(null);
    setView("button");
  };

  if (error && !cfg) {
    return null;
  }

  const posStyle: Record<string, string> = {
    position: "fixed", bottom: "20px", zIndex: "2147483647",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    ...(isRight ? { right: "20px" } : { left: "20px" }),
  };

  if (view === "button") {
    return (
      <div style={posStyle}>
        <button
          onClick={() => setView(token ? "chat" : "prechat")}
          style={{
            width: "56px", height: "56px", borderRadius: "50%",
            backgroundColor: color, color: "white", border: "none",
            cursor: "pointer", display: "flex", alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
            transition: "transform 0.2s",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.transform = "scale(1.1)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.transform = "scale(1)")}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div style={{
      ...posStyle,
      width: "380px", maxWidth: "calc(100vw - 40px)",
      height: view === "chat" ? "520px" : "auto", maxHeight: "calc(100vh - 40px)",
      borderRadius: "12px", boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
      backgroundColor: "white", overflow: "hidden",
      display: "flex", flexDirection: "column",
    }}>
      {view === "prechat" && cfg && (
        <>
          <div style={{
            padding: "20px 20px 0", backgroundColor: color, color: "white",
            borderRadius: "12px 12px 0 0",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: "600", fontSize: "16px" }}>{title}</span>
              <button onClick={() => setView("button")} style={{
                background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "6px",
                padding: "4px", cursor: "pointer", color: "white", display: "flex",
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6" /></svg>
              </button>
            </div>
            <p style={{ fontSize: "13px", opacity: 0.9, marginTop: "8px", paddingBottom: "16px", lineHeight: "1.4" }}>
              {cfg.welcome_message || "We're here to help!"}
            </p>
          </div>
          <PreChatForm fields={fields} color={color} onSubmit={handlePreChatSubmit} />
        </>
      )}
      {view === "chat" && token && (
        <ChatWindow
          sessionToken={token}
          title={title}
          color={color}
          onClose={() => setView("button")}
          onEnd={handleEnd}
        />
      )}
    </div>
  );
}

export function init(el: HTMLElement, accountId: string, siteUrl: string) {
  const shadow = el.attachShadow({ mode: "open" });
  const container = document.createElement("div");
  shadow.appendChild(container);
  render(<Widget accountId={accountId} siteUrl={siteUrl} />, container);
}

// Auto-init from script tag data attributes
(function autoInit() {
  const script = document.currentScript as HTMLScriptElement | null;
  if (!script) return;
  const accountId = script.getAttribute("data-account");
  const siteUrl = script.getAttribute("data-site") || script.src.split("/api/")[0];
  if (!accountId || !siteUrl) return;
  const host = document.createElement("div");
  host.id = "excom-chat-widget";
  document.body.appendChild(host);
  (window as any).ExcomChat = { init };
  init(host, accountId, siteUrl);
})();
