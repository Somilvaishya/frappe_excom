import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Bell,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  Palette,
  RefreshCw,
  Shield,
} from "lucide-react";
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { useExcomBranding } from "../hooks/useBranding";

declare global {
  interface Window {
    frappePushNotification?: {
      enableNotification: () => Promise<{
        permission_granted: boolean;
        token?: string;
      }>;
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

export function SettingsPage({ onNavigateBack }: SettingsPageProps) {
  const { branding } = useExcomBranding();
  const { data: mobileRaw, mutate: refreshMobile } = useFrappeGetCall<{
    message: MobileDiscovery;
  }>("excom.excom.api.mobile.get_client_id");
  const mobile = mobileRaw?.message;

  const { data: pushEnabledRaw, mutate: refreshPushFlag } = useFrappeGetCall<{
    message: boolean;
  }>("excom.excom.api.notification.are_push_notifications_enabled");
  const serverPushEnabled = Boolean(pushEnabledRaw?.message);

  const { call: createOAuthClient, loading: creatingOAuth } = useFrappePostCall(
    "excom.excom.api.mobile.create_oauth_client"
  );

  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );
  const [pushBusy, setPushBusy] = useState(false);
  const [fcmRegistered, setFcmRegistered] = useState(false);

  /** Relay stores the token under this key (Firebase Messaging is used only as the browser API; site uses Frappe relay). */
  const checkRelayTokenLocal = useCallback(() => {
    try {
      const v =
        typeof localStorage !== "undefined" &&
        localStorage.getItem("firebase_token_excom") != null;
      setFcmRegistered(v);
    } catch {
      setFcmRegistered(false);
    }
  }, []);

  useEffect(() => {
    setNotifPerm(
      typeof Notification !== "undefined" ? Notification.permission : "denied"
    );
    checkRelayTokenLocal();
  }, [checkRelayTokenLocal]);

  const copyText = (label: string, text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const handleCreateOAuth = async () => {
    try {
      await createOAuthClient({});
      toast.success("OAuth client ready — linked in Excom Settings.");
      await refreshMobile();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not create OAuth client";
      toast.error(msg);
    }
  };

  const handleEnablePush = async () => {
    setPushBusy(true);
    try {
      const helper = window.frappePushNotification;
      if (!helper) {
        toast.error("Push helper not loaded — refresh the page and try again.");
        return;
      }
      const result = await helper.enableNotification();
      setNotifPerm(Notification.permission);
      checkRelayTokenLocal();
      if (result.permission_granted) {
        toast.success("Push notifications enabled for this browser.");
        await refreshPushFlag();
      } else {
        toast.message("Notifications blocked", {
          description: "Allow them in your browser site settings for this site.",
        });
      }
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Could not enable push notifications";
      toast.error(msg);
    } finally {
      setPushBusy(false);
    }
  };

  const handleDisablePush = async () => {
    setPushBusy(true);
    try {
      await window.frappePushNotification?.disableNotification();
      checkRelayTokenLocal();
      toast.success("This device was unsubscribed from push.");
    } catch {
      toast.error("Could not disable push on this device.");
    } finally {
      setPushBusy(false);
    }
  };

  const permLabel =
    notifPerm === "granted"
      ? "Allowed"
      : notifPerm === "denied"
        ? "Blocked"
        : "Not asked yet";

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
        <h1 className="text-lg font-semibold text-white">Excom settings</h1>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y p-4 md:p-8 max-w-2xl mx-auto w-full space-y-8 pb-24">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="flex items-center gap-2 text-white font-medium mb-1">
            <Palette className="w-4 h-4 text-blue-400" />
            Branding & header
          </div>
          <p className="text-sm text-zinc-400 mb-4">
            Logo gradient and app name in the sidebar are controlled in{" "}
            <span className="text-zinc-300">Excom Settings</span> on the desk.
          </p>
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-xl shrink-0 flex items-center justify-center shadow-lg"
              style={{
                background: `linear-gradient(to bottom right, ${
                  branding?.logo_gradient_from ?? "#3b82f6"
                }, ${branding?.logo_gradient_to ?? "#9333ea"})`,
              }}
            />
            <div className="min-w-0">
              {branding?.show_app_name && (
                <p className="text-sm text-zinc-300 font-medium truncate">
                  Header title: {branding.app_name || "Excom"}
                </p>
              )}
              {!branding?.show_app_name && (
                <p className="text-sm text-zinc-500">
                  App name above the logo is hidden (enable &quot;Show App Name
                  in Header&quot; in Excom Settings).
                </p>
              )}
              <a
                href="/app/excom-settings/Excom%20Settings"
                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-2"
              >
                Open Excom Settings <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="flex items-center gap-2 text-white font-medium mb-1">
            <Bell className="w-4 h-4 text-amber-400" />
            Browser notifications
          </div>
          <p className="text-sm text-zinc-400 mb-4">
            Excom uses the same{" "}
            <span className="text-zinc-300 font-medium">Push Notification relay</span> as
            desk (Push Notification Settings). You still need to subscribe this browser: grant permission
            below so your device registers with the relay.
          </p>
          <div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
            <span className="text-zinc-500">Browser permission:</span>
            <span
              className={
                notifPerm === "granted"
                  ? "text-emerald-400"
                  : notifPerm === "denied"
                    ? "text-red-400"
                    : "text-amber-400"
              }
            >
              {permLabel}
            </span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-500">Server relay:</span>
            <span
              className={serverPushEnabled ? "text-emerald-400" : "text-zinc-500"}
            >
              {serverPushEnabled ? "On (desk)" : "Off — enable in Push Notification Settings"}
            </span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-500">This browser:</span>
            <span className={fcmRegistered ? "text-emerald-400" : "text-zinc-500"}>
              {fcmRegistered ? "Subscribed" : "Not subscribed"}
            </span>
          </div>
          {serverPushEnabled && notifPerm === "granted" && !fcmRegistered && (
            <p className="text-xs text-amber-400/90 mb-4">
              Permission alone does not register you. Tap &quot;Allow push notifications&quot; to finish.
              In <code className="text-zinc-400">site_config.json</code>,{" "}
              <code className="text-zinc-400">push_relay_server_url</code> must be the{" "}
              <strong className="text-zinc-400">Frappe notification relay</strong> host (the site that runs
              the <code className="text-zinc-400">notification_relay</code> app)—not your ERPNext URL. Frappe
              Cloud sets this automatically; self-hosted needs a real relay URL.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void handleEnablePush()}
              disabled={pushBusy || notifPerm === "denied"}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              {pushBusy ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Allow push notifications
            </Button>
            {fcmRegistered && (
              <Button
                variant="outline"
                onClick={() => void handleDisablePush()}
                disabled={pushBusy}
                className="border-zinc-700 text-zinc-300"
              >
                Unsubscribe this browser
              </Button>
            )}
          </div>
          {notifPerm === "denied" && (
            <p className="text-xs text-red-400/90 mt-3">
              This site is blocked in your browser. Open site settings and allow
              notifications for this origin, then reload Excom.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="flex items-center gap-2 text-white font-medium mb-1">
            <KeyRound className="w-4 h-4 text-purple-400" />
            Mobile app OAuth (PKCE)
          </div>
          <p className="text-sm text-zinc-400 mb-4">
            The native / PWA companion apps use an OAuth 2 client defined in
            Excom Settings. Use your site URL as the server base; the redirect
            URI must match your app bundle.
          </p>

          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-zinc-500 text-xs uppercase tracking-wide mb-1">
                Site URL
              </dt>
              <dd className="flex flex-wrap items-center gap-2">
                <code className="text-zinc-200 bg-zinc-800 px-2 py-1 rounded break-all">
                  {mobile?.site_url || "—"}
                </code>
                {mobile?.site_url ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-zinc-500"
                    onClick={() => copyText("Site URL", mobile.site_url)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                ) : null}
              </dd>
              <p className="text-xs text-zinc-500 mt-2 max-w-xl">
                Detected from your current request or{" "}
                <code className="text-zinc-400">host_name</code> in site config,
                without the bench web port. If it is still wrong, set{" "}
                <strong className="text-zinc-400">Mobile public site URL</strong>{" "}
                on Excom Settings in Desk (or{" "}
                <code className="text-zinc-400">mobile_public_site_url</code> in{" "}
                <code className="text-zinc-400">site_config.json</code>).
              </p>
            </div>
            <div>
              <dt className="text-zinc-500 text-xs uppercase tracking-wide mb-1">
                OAuth client ID
              </dt>
              <dd className="flex flex-wrap items-center gap-2">
                <code className="text-zinc-200 bg-zinc-800 px-2 py-1 rounded break-all">
                  {mobile?.client_id || "Not configured"}
                </code>
                {mobile?.client_id ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-zinc-500"
                    onClick={() => copyText("Client ID", mobile.client_id!)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 text-xs uppercase tracking-wide mb-1">
                Redirect URI
              </dt>
              <dd className="flex flex-wrap items-center gap-2">
                <code className="text-zinc-200 bg-zinc-800 px-2 py-1 rounded">
                  {MOBILE_REDIRECT_SCHEME}
                </code>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-zinc-500"
                  onClick={() =>
                    copyText("Redirect URI", MOBILE_REDIRECT_SCHEME)
                  }
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <span className="text-xs text-zinc-500 w-full">
                  Must match the OAuth Client &quot;Redirect URIs&quot; in desk
                  (already set when using &quot;Create OAuth Client&quot; below).
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 text-xs uppercase tracking-wide mb-1">
                Site name
              </dt>
              <dd className="text-zinc-300">{mobile?.sitename || "—"}</dd>
            </div>
          </dl>

          {mobile?.can_manage_mobile_oauth ? (
            <div className="mt-5 flex flex-wrap gap-2 items-center">
              <Button
                onClick={() => void handleCreateOAuth()}
                disabled={creatingOAuth}
                className="border border-purple-500/50 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20"
              >
                {creatingOAuth ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Create or refresh OAuth client
              </Button>
              <a
                href="/app/excom-settings/Excom%20Settings"
                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
              >
                Manual: Excom Settings → Mobile App <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ) : (
            <p className="mt-4 text-xs text-zinc-500 flex items-start gap-2">
              <Shield className="w-4 h-4 shrink-0 mt-0.5 text-zinc-600" />
              Only System Manager or Excom Manager can create the OAuth client
              from this screen. Others can copy the values above for app setup.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
