let siteUrl = "";

export function setSiteUrl(url: string) {
  siteUrl = url.replace(/\/$/, "");
}

async function call<T>(method: string, args: Record<string, string>): Promise<T> {
  const url = `${siteUrl}/api/method/excom.excom.api.webchat.${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Frappe-CSRF-Token": "None" },
    body: JSON.stringify(args),
    credentials: "include",
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  return data.message;
}

export interface WidgetConfig {
  title: string;
  welcome_message: string;
  offline_message: string;
  color: string;
  position: string;
  prechat_fields: string;
}

export interface SessionResponse {
  session_token: string;
  thread_id: string;
  welcome_message: string;
}

export interface ChatMessage {
  id: string;
  direction: string;
  content: string;
  message_type: string;
  timestamp: string;
  sender_name: string;
}

export const getConfig = (accountId: string) =>
  call<WidgetConfig>("get_config", { account_id: accountId });

export const createSession = (
  accountId: string, name: string, email: string, phone: string, pageUrl: string
) =>
  call<SessionResponse>("create_session", {
    account_id: accountId,
    visitor_name: name,
    visitor_email: email,
    visitor_phone: phone,
    page_url: pageUrl,
    user_agent: navigator.userAgent,
  });

export const sendVisitorMessage = (token: string, content: string) =>
  call<{ success: boolean; message_id: string }>("send_visitor_message", {
    session_token: token, content,
  });

export const getVisitorMessages = (token: string, after = "") =>
  call<ChatMessage[]>("get_visitor_messages", { session_token: token, after });

export const endSession = (token: string) =>
  call<void>("end_session", { session_token: token });
