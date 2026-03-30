import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft, Bell, Copy, ExternalLink, KeyRound, Loader2,
  Mail, MessageSquare, Palette, RefreshCw, Reply, Shield,
  Volume2, VolumeX, Zap, RotateCcw, Users,
} from "lucide-react";
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { useExcomBranding } from "../hooks/useBranding";

declare global {
  interface Window {
    frappePushNotification?: {
      enableNotification: () => Promise<{ permission_granted: boolean; token?: string }>;
      disableNotification: () => Promise<void>;
      isNotificationEnabled: () => boolean;
    };
  }
}

interface MobileDiscovery {
  client_id: string | null;
  sitename: string;
  site_url: string;
  app_name: string;
  can_manage_mobile_oauth: boolean;
}

interface SettingsPageProps {
  onNavigateBack: () => void;
}

const MOBILE_REDIRECT_SCHEME = "excom.app:";

type SectionId =
  | "general"
  | "signatures"
  | "notifications"
  | "branding"
  | "accounts"
  | "shortcuts"
  | "canned"
  | "auto-reply";

interface NavItem {
  id: SectionId;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { id: "general", label: "General", icon: <Zap className="w-4 h-4" /> },
  { id: "signatures", label: "Email Signatures", icon: <Mail className="w-4 h-4" /> },
  { id: "notifications", label: "Notifications", icon: <Bell className="w-4 h-4" /> },
  { id: "branding", label: "Branding", icon: <Palette className="w-4 h-4" /> },
  { id: "accounts", label: "Accounts", icon: <Users className="w-4 h-4" /> },
  { id: "shortcuts", label: "Keyboard Shortcuts", icon: <KeyRound className="w-4 h-4" /> },
  { id: "canned", label: "Canned Responses", icon: <MessageSquare className="w-4 h-4" /> },
  { id: "auto-reply", label: "Auto-Reply", icon: <Reply className="w-4 h-4" /> },
];

export function SettingsPage({ onNavigateBack }: SettingsPageProps) {
  const [activeSection, setActiveSection] = useState<SectionId>("general");
  const { branding } = useExcomBranding();

  return (
    <div className="h-full min-h-0 w-full bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="shrink-0 border-b border-zinc-800 px-4 py-3 flex items-center gap-3 bg-zinc-900/80">
        <Button
          variant="ghost"
          size="icon"
          onClick={onNavigateBack}
          className="text-zinc-400 hover:text-white"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold text-white">Settings</h1>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Left nav */}
        <nav className="w-52 shrink-0 border-r border-zinc-800 bg-zinc-900/40 flex flex-col py-3 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors text-left ${
                activeSection === item.id
                  ? "bg-blue-500/10 text-blue-400 border-r-2 border-blue-500"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* Content panel */}
        <div className="flex-1 min-w-0 overflow-y-auto p-6">
          {activeSection === "general" && <GeneralSection siteUrl={""} />}
          {activeSection === "signatures" && <SignaturesSection />}
          {activeSection === "notifications" && <NotificationsSection />}
          {activeSection === "branding" && <BrandingSection branding={branding} />}
          {activeSection === "accounts" && <AccountsSection />}
          {activeSection === "shortcuts" && <ShortcutsSection />}
          {activeSection === "canned" && <CannedSection />}
          {activeSection === "auto-reply" && <AutoReplySection />}
        </div>
      </div>
    </div>
  );
}

/* ─── General ─────────────────────────────────────────────────────────────── */

function GeneralSection({ siteUrl: _siteUrl }: { siteUrl: string }) {
  const { data: mobileRaw, mutate: refreshMobile } = useFrappeGetCall<{
    message: MobileDiscovery;
  }>("excom.excom.api.mobile.get_client_id");
  const mobile = mobileRaw?.message;

  const { call: createOAuthClient, loading: creatingOAuth } = useFrappePostCall(
    "excom.excom.api.mobile.create_oauth_client"
  );

  const copyText = (label: string, text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const handleCreateOAuth = async () => {
    try {
      await createOAuthClient({});
      toast.success("OAuth client ready.");
      await refreshMobile();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not create OAuth client");
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <SectionHeader icon={<Zap className="w-4 h-4 text-blue-400" />} title="General" />

      <Card>
        <div className="flex items-center gap-2 text-white font-medium mb-1">
          <KeyRound className="w-4 h-4 text-purple-400" />
          Mobile app OAuth (PKCE)
        </div>
        <p className="text-sm text-zinc-400 mb-4">
          The native / PWA companion apps use an OAuth 2 client defined in Excom Settings.
        </p>
        <dl className="space-y-3 text-sm">
          <InfoRow label="Site URL" value={mobile?.site_url} onCopy={(v) => copyText("Site URL", v)} />
          <InfoRow label="OAuth client ID" value={mobile?.client_id || undefined} onCopy={(v) => copyText("Client ID", v)} />
          <InfoRow label="Redirect URI" value={MOBILE_REDIRECT_SCHEME} onCopy={(v) => copyText("Redirect URI", v)} />
          <InfoRow label="Site name" value={mobile?.sitename} />
        </dl>
        {mobile?.can_manage_mobile_oauth ? (
          <div className="mt-5 flex flex-wrap gap-2 items-center">
            <Button
              onClick={() => void handleCreateOAuth()}
              disabled={creatingOAuth}
              className="border border-purple-500/50 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20"
            >
              {creatingOAuth ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Create or refresh OAuth client
            </Button>
            <a href="/app/excom-settings/Excom%20Settings" className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
              Excom Settings <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        ) : (
          <p className="mt-4 text-xs text-zinc-500 flex items-start gap-2">
            <Shield className="w-4 h-4 shrink-0 mt-0.5 text-zinc-600" />
            Only System Manager or Excom Manager can create the OAuth client.
          </p>
        )}
      </Card>
    </div>
  );
}

/* ─── Email Signatures ─────────────────────────────────────────────────────── */

function SignaturesSection() {
  const { data: sigRaw, mutate: refreshSig } = useFrappeGetCall<{
    message: { exists: boolean; signature_html: string; position: string };
  }>("excom.excom.api.email.get_my_signature");

  const { call: saveSig, loading: saving } = useFrappePostCall(
    "excom.excom.api.email.save_my_signature"
  );

  const [html, setHtml] = useState("");
  const [position, setPosition] = useState("Below Reply");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (sigRaw?.message && !loaded) {
      setHtml(sigRaw.message.signature_html || "");
      setPosition(sigRaw.message.position || "Below Reply");
      setLoaded(true);
    }
  }, [sigRaw, loaded]);

  const handleSave = async () => {
    try {
      await saveSig({ signature_html: html, position });
      toast.success("Signature saved");
      await refreshSig();
    } catch {
      toast.error("Failed to save signature");
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <SectionHeader icon={<Mail className="w-4 h-4 text-emerald-400" />} title="Email Signatures" />
      <Card>
        <p className="text-sm text-zinc-400 mb-4">
          Your signature is appended to outgoing emails. Supports HTML formatting.
        </p>
        <div className="mb-4">
          <label className="block text-xs text-zinc-500 mb-1 uppercase tracking-wide">Position</label>
          <div className="flex gap-2">
            {["Below Reply", "Below All"].map((opt) => (
              <button
                key={opt}
                onClick={() => setPosition(opt)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  position === opt
                    ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-white"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-xs text-zinc-500 mb-1 uppercase tracking-wide">Signature (HTML)</label>
          <textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            rows={8}
            className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 font-mono resize-y focus:outline-none focus:border-blue-500 placeholder:text-zinc-600"
            placeholder="<p>Best regards,<br><strong>Your Name</strong></p>"
          />
        </div>
        {html && (
          <div className="mb-4">
            <label className="block text-xs text-zinc-500 mb-1 uppercase tracking-wide">Preview</label>
            <div
              className="border border-zinc-700 rounded-lg p-3 text-sm text-zinc-300 bg-zinc-800/40"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        )}
        <Button
          onClick={() => void handleSave()}
          disabled={saving}
          className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Save Signature
        </Button>
      </Card>
    </div>
  );
}

/* ─── Notifications ─────────────────────────────────────────────────────────── */

function NotificationsSection() {
  const { data: pushEnabledRaw, mutate: refreshPushFlag } = useFrappeGetCall<{
    message: boolean;
  }>("excom.excom.api.notification.are_push_notifications_enabled");
  const serverPushEnabled = Boolean(pushEnabledRaw?.message);

  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );
  const [pushBusy, setPushBusy] = useState(false);
  const [fcmRegistered, setFcmRegistered] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(
    () => localStorage.getItem("excom_sound_enabled") !== "false"
  );

  const checkRelayTokenLocal = useCallback(() => {
    try {
      setFcmRegistered(typeof localStorage !== "undefined" && localStorage.getItem("firebase_token_excom") != null);
    } catch {
      setFcmRegistered(false);
    }
  }, []);

  useEffect(() => {
    setNotifPerm(typeof Notification !== "undefined" ? Notification.permission : "denied");
    checkRelayTokenLocal();
  }, [checkRelayTokenLocal]);

  const handleSoundToggle = (val: boolean) => {
    setSoundEnabled(val);
    localStorage.setItem("excom_sound_enabled", String(val));
    toast.success(val ? "Notification sound on" : "Notification sound off");
  };

  const handleEnablePush = async () => {
    setPushBusy(true);
    try {
      const helper = window.frappePushNotification;
      if (!helper) { toast.error("Push helper not loaded — refresh and try again."); return; }
      const result = await helper.enableNotification();
      setNotifPerm(Notification.permission);
      checkRelayTokenLocal();
      if (result.permission_granted) {
        toast.success("Push notifications enabled.");
        await refreshPushFlag();
      } else {
        toast.message("Notifications blocked", { description: "Allow in browser site settings." });
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not enable push notifications");
    } finally {
      setPushBusy(false);
    }
  };

  const handleDisablePush = async () => {
    setPushBusy(true);
    try {
      await window.frappePushNotification?.disableNotification();
      checkRelayTokenLocal();
      toast.success("Unsubscribed from push on this device.");
    } catch {
      toast.error("Could not disable push on this device.");
    } finally {
      setPushBusy(false);
    }
  };

  const permLabel = notifPerm === "granted" ? "Allowed" : notifPerm === "denied" ? "Blocked" : "Not asked yet";

  return (
    <div className="max-w-2xl space-y-6">
      <SectionHeader icon={<Bell className="w-4 h-4 text-amber-400" />} title="Notifications" />

      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-medium text-white text-sm">Notification sound</p>
            <p className="text-xs text-zinc-400 mt-0.5">Play a tone when a new message arrives, even when this tab is focused.</p>
          </div>
          <button
            onClick={() => handleSoundToggle(!soundEnabled)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
              soundEnabled
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            {soundEnabled ? "On" : "Off"}
          </button>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-2 text-white font-medium mb-1">
          <Bell className="w-4 h-4 text-amber-400" />
          Browser push notifications
        </div>
        <p className="text-sm text-zinc-400 mb-4">
          Uses the Frappe Push Notification relay. Subscribe this browser to receive alerts in the background.
        </p>
        <div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
          <span className="text-zinc-500">Browser:</span>
          <span className={notifPerm === "granted" ? "text-emerald-400" : notifPerm === "denied" ? "text-red-400" : "text-amber-400"}>
            {permLabel}
          </span>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-500">Server:</span>
          <span className={serverPushEnabled ? "text-emerald-400" : "text-zinc-500"}>
            {serverPushEnabled ? "On" : "Off"}
          </span>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-500">This browser:</span>
          <span className={fcmRegistered ? "text-emerald-400" : "text-zinc-500"}>
            {fcmRegistered ? "Subscribed" : "Not subscribed"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => void handleEnablePush()}
            disabled={pushBusy || notifPerm === "denied"}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          >
            {pushBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Allow push notifications
          </Button>
          {fcmRegistered && (
            <Button variant="outline" onClick={() => void handleDisablePush()} disabled={pushBusy} className="border-zinc-700 text-zinc-300">
              Unsubscribe this browser
            </Button>
          )}
        </div>
        {notifPerm === "denied" && (
          <p className="text-xs text-red-400/90 mt-3">
            This site is blocked in your browser. Open site settings, allow notifications, then reload.
          </p>
        )}
      </Card>
    </div>
  );
}

/* ─── Branding ─────────────────────────────────────────────────────────────── */

function BrandingSection({ branding }: { branding: ReturnType<typeof useExcomBranding>["branding"] }) {
  return (
    <div className="max-w-2xl space-y-6">
      <SectionHeader icon={<Palette className="w-4 h-4 text-pink-400" />} title="Branding" />
      <Card>
        <p className="text-sm text-zinc-400 mb-4">
          Logo gradient, app name, and colours are managed in{" "}
          <a href="/app/excom-settings/Excom%20Settings" className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1">
            Excom Settings <ExternalLink className="w-3 h-3" />
          </a>{" "}
          on the desk.
        </p>
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-xl shrink-0 flex items-center justify-center shadow-lg"
            style={{ background: `linear-gradient(to bottom right, ${branding?.logo_gradient_from ?? "#3b82f6"}, ${branding?.logo_gradient_to ?? "#9333ea"})` }}
          />
          <div className="min-w-0">
            {branding?.show_app_name ? (
              <p className="text-sm text-zinc-300 font-medium truncate">Header title: {branding.app_name || "Excom"}</p>
            ) : (
              <p className="text-sm text-zinc-500">App name in header is hidden. Enable "Show App Name in Header" in Excom Settings.</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ─── Accounts ─────────────────────────────────────────────────────────────── */

interface ChannelAccountItem {
  name: string;
  channel: string;
  account_name: string;
  email_address?: string;
  wa_phone_id?: string;
}

function AccountsSection() {
  const { data: raw } = useFrappeGetCall<{ message: ChannelAccountItem[] }>(
    "excom.excom.api.chat.get_channel_accounts"
  );
  const accounts: ChannelAccountItem[] = Array.isArray(raw?.message) ? raw!.message : [];

  const CHANNEL_BADGE: Record<string, string> = {
    WhatsApp: "bg-green-500/15 text-green-400 border-green-500/30",
    Email: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    Instagram: "bg-pink-500/15 text-pink-400 border-pink-500/30",
  };

  return (
    <div className="max-w-2xl space-y-6">
      <SectionHeader icon={<Users className="w-4 h-4 text-cyan-400" />} title="Accounts" />
      <Card>
        <p className="text-sm text-zinc-400 mb-4">Channel accounts you have access to.</p>
        {accounts.length === 0 ? (
          <p className="text-sm text-zinc-600">No accounts available.</p>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {accounts.map((acc) => (
              <li key={acc.name} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">{acc.account_name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{acc.email_address || acc.wa_phone_id || acc.name}</p>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${CHANNEL_BADGE[acc.channel] || "bg-zinc-700/30 text-zinc-400 border-zinc-600"}`}>
                  {acc.channel}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ─── Keyboard Shortcuts ───────────────────────────────────────────────────── */

const SHORTCUTS = [
  { keys: ["⌘", "K"], desc: "Open search / command palette" },
  { keys: ["⌘", "N"], desc: "New conversation" },
  { keys: ["⌘", "↵"], desc: "Send message" },
  { keys: ["Esc"], desc: "Close open dialogs" },
  { keys: ["⌘", "/"], desc: "Focus message input" },
  { keys: ["J"], desc: "Next conversation" },
  { keys: ["K"], desc: "Previous conversation" },
];

function ShortcutsSection() {
  return (
    <div className="max-w-2xl space-y-6">
      <SectionHeader icon={<KeyRound className="w-4 h-4 text-purple-400" />} title="Keyboard Shortcuts" />
      <Card>
        <p className="text-sm text-zinc-400 mb-4">Available keyboard shortcuts for power users.</p>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-zinc-800">
            {SHORTCUTS.map(({ keys, desc }, i) => (
              <tr key={i} className="py-2">
                <td className="py-2.5 pr-4 w-40">
                  <div className="flex items-center gap-1">
                    {keys.map((k) => (
                      <kbd key={k} className="inline-flex items-center px-1.5 py-0.5 rounded border border-zinc-600 bg-zinc-800 text-xs font-mono text-zinc-300">
                        {k}
                      </kbd>
                    ))}
                  </div>
                </td>
                <td className="py-2.5 text-zinc-300">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-zinc-600 mt-4">Use Ctrl instead of ⌘ on Windows/Linux.</p>
      </Card>
    </div>
  );
}

/* ─── Canned Responses ─────────────────────────────────────────────────────── */

interface CannedResponse {
  name: string;
  title: string;
  shortcode: string;
  content: string;
}

function CannedSection() {
  const { data: raw, mutate: refresh } = useFrappeGetCall<{ message: CannedResponse[] }>(
    "frappe.client.get_list",
    {
      doctype: "Excom Canned Response",
      fields: ["name", "title", "shortcode", "content"],
      limit_page_length: 50,
      order_by: "title asc",
    }
  );
  const items: CannedResponse[] = Array.isArray(raw?.message) ? raw!.message : [];

  const { call: insertDoc } = useFrappePostCall("frappe.client.insert");

  const [newTitle, setNewTitle] = useState("");
  const [newShortcode, setNewShortcode] = useState("");
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!newTitle.trim() || !newContent.trim()) { toast.error("Title and content are required."); return; }
    const shortcode = (newShortcode.trim() || newTitle.trim()).toLowerCase().replace(/[^a-z0-9_]/g, "_");
    setSaving(true);
    try {
      await insertDoc({
        doc: JSON.stringify({
          doctype: "Excom Canned Response",
          title: newTitle.trim(),
          shortcode,
          content: newContent.trim(),
        }),
      });
      setNewTitle(""); setNewShortcode(""); setNewContent("");
      toast.success("Canned response added.");
      await refresh();
    } catch {
      toast.error("Failed to save. Check if the shortcode is already taken.");
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <SectionHeader icon={<MessageSquare className="w-4 h-4 text-indigo-400" />} title="Canned Responses" />
      <Card>
        <p className="text-sm text-zinc-400 mb-4">Quick-reply templates triggered by typing <code className="text-zinc-300">/shortcode</code> in chat.</p>
        {items.length > 0 && (
          <ul className="divide-y divide-zinc-800 mb-4">
            {items.map((item) => (
              <li key={item.name} className="py-2.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <span className="text-xs text-zinc-500 font-mono">/{item.shortcode}</span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{item.content}</p>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-zinc-800 pt-4 space-y-2">
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Add new</p>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Title (e.g. Greeting)"
            className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
          />
          <input
            value={newShortcode}
            onChange={(e) => setNewShortcode(e.target.value)}
            placeholder="Shortcode (e.g. greeting) — auto-generated from title if empty"
            className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-blue-500"
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Response content…"
            rows={3}
            className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 resize-y focus:outline-none focus:border-blue-500"
          />
          <Button onClick={() => void handleAdd()} disabled={saving} size="sm" className="bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}Add
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* ─── Auto-Reply ───────────────────────────────────────────────────────────── */

function AutoReplySection() {
  return (
    <div className="max-w-2xl space-y-6">
      <SectionHeader icon={<RotateCcw className="w-4 h-4 text-teal-400" />} title="Auto-Reply" />
      <Card>
        <p className="text-sm text-zinc-400 mb-2">
          Configure automatic replies per channel account — e.g., out-of-office messages, welcome messages.
        </p>
        <p className="text-xs text-zinc-600 p-3 rounded-lg bg-zinc-800/40 border border-zinc-700/50">
          Auto-reply rule management coming soon. For now, configure rules via the Frappe desk under{" "}
          <a href="/app" className="text-blue-400 hover:text-blue-300">Excom modules</a>.
        </p>
      </Card>
    </div>
  );
}

/* ─── Shared helpers ───────────────────────────────────────────────────────── */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      {children}
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      {icon}
      <h2 className="text-base font-semibold text-white">{title}</h2>
    </div>
  );
}

function InfoRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value?: string | null;
  onCopy?: (v: string) => void;
}) {
  return (
    <div>
      <dt className="text-zinc-500 text-xs uppercase tracking-wide mb-1">{label}</dt>
      <dd className="flex flex-wrap items-center gap-2">
        <code className="text-zinc-200 bg-zinc-800 px-2 py-1 rounded break-all text-xs">
          {value || "—"}
        </code>
        {value && onCopy && (
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-zinc-500" onClick={() => onCopy(value)}>
            <Copy className="w-3.5 h-3.5" />
          </Button>
        )}
      </dd>
    </div>
  );
}
