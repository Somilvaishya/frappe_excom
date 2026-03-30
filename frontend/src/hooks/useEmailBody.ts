import { useState, useCallback } from "react";
import { useFrappePostCall } from "frappe-react-sdk";

interface EmailBody {
  body_html: string;
  body_text: string;
  subject: string;
  from_email: string;
  from_name: string;
  to: string;
  cc: string;
  date: string;
  attachments: Array<{
    filename: string;
    mimeType: string;
    size: number;
    attachmentId: string;
  }>;
  deleted: boolean;
  error?: string;
}

/**
 * Fetches the full email body from Gmail API on-demand.
 * Bodies are never stored in the database -- fetched live each time.
 */
export function useEmailBody() {
  const [bodies, setBodies] = useState<Record<string, EmailBody>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const { call } = useFrappePostCall("excom.excom.api.email.get_email_body");

  const fetchBody = useCallback(
    async (messageName: string) => {
      if (bodies[messageName] || loading[messageName]) return;

      setLoading((prev) => ({ ...prev, [messageName]: true }));
      try {
        const result = await call({ message_name: messageName });
        const data = (result as any)?.message || result;
        setBodies((prev) => ({ ...prev, [messageName]: data as EmailBody }));
      } catch (err) {
        setBodies((prev) => ({
          ...prev,
          [messageName]: {
            body_html: "",
            body_text: "",
            subject: "",
            from_email: "",
            from_name: "",
            to: "",
            cc: "",
            date: "",
            attachments: [],
            deleted: true,
            error: "Failed to fetch email body",
          },
        }));
      } finally {
        setLoading((prev) => ({ ...prev, [messageName]: false }));
      }
    },
    [bodies, loading, call],
  );

  const retryFetch = useCallback(
    (messageName: string) => {
      // Clear cached result so fetchBody will re-fetch
      setBodies((prev) => {
        const next = { ...prev };
        delete next[messageName];
        return next;
      });
      // Trigger fetch immediately after clearing
      setTimeout(() => fetchBody(messageName), 50);
    },
    [fetchBody],
  );

  return { bodies, loading, fetchBody, retryFetch };
}
