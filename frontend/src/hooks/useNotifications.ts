import { useCallback, useEffect, useRef } from "react";
import { useFrappeEventListener } from "frappe-react-sdk";

const BASE_TITLE = (window as any).app_name || "Excom";

// ── Favicon badge ────────────────────────────────────────────────

let originalFaviconHref: string | null = null;

function getOriginalFavicon(): string {
  if (originalFaviconHref) return originalFaviconHref;
  const link = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
  originalFaviconHref = link?.href || "";
  return originalFaviconHref;
}

function setFavicon(href: string) {
  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = href;
}

function drawBadgeFavicon(count: number) {
  if (count <= 0) {
    const original = getOriginalFavicon();
    if (original) {
      setFavicon(original);
    } else {
      drawDefaultFavicon(0);
    }
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;

  const original = getOriginalFavicon();
  if (original) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 64, 64);
      drawBadge(ctx, count);
      setFavicon(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      drawDefaultFavicon(count);
    };
    img.src = original;
  } else {
    drawDefaultFavicon(count);
  }
}

function drawDefaultFavicon(count: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;

  const gradient = ctx.createLinearGradient(0, 0, 64, 64);
  gradient.addColorStop(0, "#3b82f6");
  gradient.addColorStop(1, "#8b5cf6");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(0, 0, 64, 64, 14);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 32px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("E", 32, 34);

  if (count > 0) {
    drawBadge(ctx, count);
  }
  setFavicon(canvas.toDataURL("image/png"));
}

function drawBadge(ctx: CanvasRenderingContext2D, count: number) {
  const text = count > 99 ? "99+" : String(count);
  const fontSize = text.length > 2 ? 18 : 22;
  ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
  const textWidth = ctx.measureText(text).width;
  const padding = 6;
  const badgeW = Math.max(textWidth + padding * 2, 28);
  const badgeH = 26;
  const x = 64 - badgeW;
  const y = 0;

  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.roundRect(x, y, badgeW, badgeH, badgeH / 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + badgeW / 2, y + badgeH / 2 + 1);
}

// ── Tab title ────────────────────────────────────────────────────

function updateTabTitle(count: number) {
  document.title = count > 0 ? `(${count}) ${BASE_TITLE}` : BASE_TITLE;
}

// ── Sound ────────────────────────────────────────────────────────

let audioCtx: AudioContext | null = null;

function playNotificationSound() {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const ctx = audioCtx;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1046, ctx.currentTime + 0.08);
    osc.frequency.setValueAtTime(1318, ctx.currentTime + 0.16);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // AudioContext not supported or blocked
  }
}

// ── Browser push notifications ───────────────────────────────────

function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function showDesktopNotification(title: string, body: string) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (document.hasFocus()) return;

  try {
    const n = new Notification(title, {
      body,
      icon: "/assets/excom/excom/manifest/icon-192.png",
      tag: "excom-new-message",
      renotify: true,
      silent: true,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
    setTimeout(() => n.close(), 8000);
  } catch {
    // Notification not supported in this context
  }
}

// ── Hook ─────────────────────────────────────────────────────────

interface InboundEvent {
  thread: string;
  message: string;
  omni_identity: string;
  direction: "Inbound" | "Outbound";
  preview: string;
  display_name?: string;
}

export function useNotifications(totalUnread: number) {
  const prevUnreadRef = useRef(totalUnread);

  useEffect(() => {
    getOriginalFavicon();
    drawBadgeFavicon(totalUnread);
    requestNotificationPermission();
  }, []);

  useEffect(() => {
    drawBadgeFavicon(totalUnread);
    updateTabTitle(totalUnread);
    prevUnreadRef.current = totalUnread;
  }, [totalUnread]);

  const handleInbound = useCallback((data: InboundEvent) => {
    if (data.direction !== "Inbound") return;

    if (!document.hasFocus()) {
      playNotificationSound();
      const sender = data.display_name || "New message";
      showDesktopNotification(sender, data.preview || "You have a new message");
    }
  }, []);

  useFrappeEventListener("excom:message_received", handleInbound);
}
