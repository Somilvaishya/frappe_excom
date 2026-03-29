import { useState, useRef, useEffect, useCallback } from "react";
import {
  Mail,
  ChevronDown,
  ChevronUp,
  Paperclip,
  Loader2,
  AlertTriangle,
  Reply,
  Download,
} from "lucide-react";
import { Badge } from "./ui/badge";
import { format } from "date-fns";

interface EmailAttachment {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
}

interface EmailBodyData {
  body_html: string;
  body_text: string;
  subject: string;
  from_email: string;
  from_name: string;
  to: string;
  cc: string;
  date: string;
  attachments: EmailAttachment[];
  deleted: boolean;
  error?: string;
}

interface EmailMessageCardProps {
  messageId: string;
  direction: "Inbound" | "Outbound";
  snippet: string;
  timestamp: Date;
  contentJson: string;
  sentBy?: { name: string; avatar: string };
  bodyData?: EmailBodyData;
  bodyLoading?: boolean;
  onExpandEmail: (messageId: string) => void;
  onReplyEmail?: (messageId: string, subject: string, to: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EmailMessageCard({
  messageId,
  direction,
  snippet,
  timestamp,
  contentJson,
  sentBy,
  bodyData,
  bodyLoading,
  onExpandEmail,
  onReplyEmail,
}: EmailMessageCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isOutbound = direction === "Outbound";

  let emailMeta = {
    subject: "(No Subject)",
    from_email: "",
    from_name: "",
    to: "",
    cc: "",
    gmail_message_id: "",
  };
  try {
    const parsed = JSON.parse(contentJson || "{}");
    emailMeta = { ...emailMeta, ...parsed };
  } catch {
    // use defaults
  }

  const handleToggle = () => {
    if (!expanded && !bodyData) {
      onExpandEmail(messageId);
    }
    setExpanded(!expanded);
  };

  return (
    <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[85%] w-full">
        <div
          className={`rounded-xl border shadow-lg overflow-hidden ${
            isOutbound
              ? "bg-blue-500/5 border-blue-500/20"
              : "bg-zinc-800/80 border-zinc-700/50"
          }`}
        >
          {/* Email header - always visible */}
          <button
            onClick={handleToggle}
            className="w-full text-left p-3 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-start gap-2">
              <Mail
                className={`w-4 h-4 mt-0.5 shrink-0 ${
                  isOutbound ? "text-blue-400" : "text-zinc-400"
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium text-zinc-300 truncate">
                    {isOutbound
                      ? `To: ${emailMeta.to}`
                      : emailMeta.from_name || emailMeta.from_email}
                  </span>
                  <span className="text-[10px] text-zinc-500 shrink-0">
                    {format(timestamp, "MMM d, h:mm a")}
                  </span>
                  {expanded ? (
                    <ChevronUp className="w-3.5 h-3.5 text-zinc-500 shrink-0 ml-auto" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0 ml-auto" />
                  )}
                </div>
                <p className="text-sm font-medium text-white truncate">
                  {emailMeta.subject}
                </p>
                {!expanded && (
                  <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                    {snippet}
                  </p>
                )}
              </div>
            </div>
          </button>

          {/* Expanded body */}
          {expanded && (
            <div className="border-t border-zinc-700/50">
              {bodyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-blue-400 animate-spin mr-2" />
                  <span className="text-sm text-zinc-400">
                    Fetching from Gmail...
                  </span>
                </div>
              ) : bodyData?.deleted ? (
                <div className="flex items-center gap-2 p-4">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <p className="text-sm text-amber-300">
                      Email no longer available
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {bodyData.error ||
                        "This email has been deleted from Gmail."}
                    </p>
                  </div>
                </div>
              ) : bodyData ? (
                <div>
                  {/* Email metadata */}
                  <div className="px-4 py-2 bg-zinc-800/30 text-xs text-zinc-400 space-y-1">
                    <div>
                      <span className="text-zinc-500">From:</span>{" "}
                      {bodyData.from_name
                        ? `${bodyData.from_name} <${bodyData.from_email}>`
                        : bodyData.from_email}
                    </div>
                    <div>
                      <span className="text-zinc-500">To:</span> {bodyData.to}
                    </div>
                    {bodyData.cc && (
                      <div>
                        <span className="text-zinc-500">Cc:</span>{" "}
                        {bodyData.cc}
                      </div>
                    )}
                    {bodyData.date && (
                      <div>
                        <span className="text-zinc-500">Date:</span>{" "}
                        {bodyData.date}
                      </div>
                    )}
                  </div>

                  {/* Email body — rendered in a light-themed iframe for style isolation */}
                  <div className="p-4">
                    {bodyData.body_html ? (
                      <EmailBodyFrame html={bodyData.body_html} />
                    ) : (
                      <pre className="text-sm text-zinc-200 whitespace-pre-wrap font-sans">
                        {bodyData.body_text || "(Empty email)"}
                      </pre>
                    )}
                  </div>

                  {/* Attachments */}
                  {bodyData.attachments.length > 0 && (
                    <div className="px-4 pb-3 border-t border-zinc-700/50 pt-2">
                      <div className="flex items-center gap-1 text-xs text-zinc-500 mb-2">
                        <Paperclip className="w-3 h-3" />
                        <span>
                          {bodyData.attachments.length} attachment
                          {bodyData.attachments.length > 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {bodyData.attachments.map((att, i) => (
                          <AttachmentChip
                            key={i}
                            attachment={att}
                            messageId={messageId}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reply action */}
                  {onReplyEmail && (
                    <div className="px-4 pb-3">
                      <button
                        onClick={() =>
                          onReplyEmail(
                            emailMeta.gmail_message_id,
                            emailMeta.subject.startsWith("Re:")
                              ? emailMeta.subject
                              : `Re: ${emailMeta.subject}`,
                            isOutbound
                              ? emailMeta.to
                              : emailMeta.from_email,
                          )
                        }
                        className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <Reply className="w-3 h-3" />
                        Reply
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <span className="text-sm text-zinc-500">
                    Click to load email content
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer: sender + timestamp */}
        <div
          className={`flex items-center gap-1 mt-1 text-xs text-zinc-500 ${
            isOutbound ? "justify-end" : "justify-start"
          }`}
        >
          <Badge className="text-[9px] px-1.5 h-4 bg-zinc-800 text-zinc-400 border-zinc-700">
            <Mail className="w-2.5 h-2.5 mr-0.5" />
            Email
          </Badge>
          {sentBy && (
            <span className="text-[10px] text-zinc-500">{sentBy.name}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function AttachmentChip({
  attachment,
  messageId,
}: {
  attachment: EmailAttachment;
  messageId: string;
}) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const params = new URLSearchParams({
        message_name: messageId,
        attachment_id: attachment.attachmentId,
        filename: attachment.filename,
      });
      const url = `/api/method/excom.excom.api.email.get_email_attachment?${params}`;

      const resp = await fetch(url);
      if (!resp.ok) throw new Error("Download failed");

      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = attachment.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback: open in new tab which triggers browser download
      const params = new URLSearchParams({
        message_name: messageId,
        attachment_id: attachment.attachmentId,
        filename: attachment.filename,
      });
      window.open(
        `/api/method/excom.excom.api.email.get_email_attachment?${params}`,
        "_blank",
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="flex items-center gap-2 px-2 py-1.5 bg-zinc-700/50 rounded-lg text-xs hover:bg-zinc-600/50 transition-colors cursor-pointer group disabled:opacity-60"
    >
      {downloading ? (
        <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
      ) : (
        <Paperclip className="w-3 h-3 text-zinc-400" />
      )}
      <span className="text-zinc-300 truncate max-w-[150px]">
        {attachment.filename}
      </span>
      <span className="text-zinc-500">{formatBytes(attachment.size)}</span>
      <Download className="w-3 h-3 text-zinc-500 group-hover:text-blue-400 transition-colors" />
    </button>
  );
}

/**
 * Renders HTML email content inside an iframe with a light background
 * so that inline styles from Gmail (black text, white bg) remain readable
 * against the app's dark theme.
 */
function EmailBodyFrame({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(200);

  const resizeFrame = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return;
    const h = doc.body.scrollHeight;
    if (h > 0) setHeight(Math.min(h + 24, 2000));
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      resizeFrame();
      const observer = new ResizeObserver(resizeFrame);
      if (iframe.contentDocument?.body) {
        observer.observe(iframe.contentDocument.body);
      }
      return () => observer.disconnect();
    };

    iframe.addEventListener("load", handleLoad);
    return () => iframe.removeEventListener("load", handleLoad);
  }, [resizeFrame]);

  const srcdoc = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  html, body { margin: 0; padding: 12px; background: #ffffff; color: #1a1a1a;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px; line-height: 1.6; word-break: break-word; }
  img { max-width: 100%; height: auto; border-radius: 4px; }
  a { color: #2563eb; }
  table { border-collapse: collapse; max-width: 100%; }
  td, th { padding: 4px 8px; }
  pre, code { white-space: pre-wrap; font-size: 13px; }
  blockquote { margin: 8px 0; padding-left: 12px; border-left: 3px solid #d1d5db; color: #4b5563; }
</style></head><body>${html}</body></html>`;

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcdoc}
      sandbox="allow-same-origin"
      className="w-full border-0 rounded-lg bg-white"
      style={{ height: `${height}px`, minHeight: "60px" }}
      title="Email content"
    />
  );
}
