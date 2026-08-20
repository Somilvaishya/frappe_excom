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
  FileText,
  FileImage,
  FileSpreadsheet,
  FileArchive,
  File,
  FileVideo,
  FileAudio,
  ExternalLink,
  ReplyAll,
  Forward,
  Star,
} from "lucide-react";
import { Badge } from "./ui/badge";
import { formatServerShortDateTime } from "../utils/datetime";

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
  onRetryFetch?: (messageId: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string, filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  if (mimeType.startsWith("image/"))
    return { icon: FileImage, color: "text-emerald-700", bg: "bg-emerald-500/15" };
  if (mimeType.startsWith("video/"))
    return { icon: FileVideo, color: "text-purple-700", bg: "bg-purple-500/15" };
  if (mimeType.startsWith("audio/"))
    return { icon: FileAudio, color: "text-pink-700", bg: "bg-pink-500/15" };
  if (mimeType === "application/pdf" || ext === "pdf")
    return { icon: FileText, color: "text-red-700", bg: "bg-red-500/15" };
  if (["doc", "docx", "odt", "rtf", "txt"].includes(ext))
    return { icon: FileText, color: "text-blue-700", bg: "bg-blue-500/15" };
  if (["xls", "xlsx", "csv", "ods"].includes(ext) || mimeType.includes("spreadsheet"))
    return { icon: FileSpreadsheet, color: "text-green-700", bg: "bg-green-500/15" };
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext) || mimeType.includes("zip") || mimeType.includes("compressed"))
    return { icon: FileArchive, color: "text-amber-700", bg: "bg-amber-500/15" };

  return { icon: File, color: "text-zinc-600", bg: "bg-zinc-300/15" };
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
  onRetryFetch,
}: EmailMessageCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showHeaders, setShowHeaders] = useState(false);
  const isOutbound = direction === "Outbound";

  let emailMeta = {
    subject: "(No Subject)",
    from_email: "",
    from_name: "",
    to: "",
    cc: "",
    gmail_message_id: "",
    label_ids: [] as string[],
    message_id_header: "",
    in_reply_to: "",
  };
  try {
    const parsed = JSON.parse(contentJson || "{}");
    emailMeta = { ...emailMeta, ...parsed };
    if (typeof emailMeta.label_ids === "string") {
      try { emailMeta.label_ids = JSON.parse(emailMeta.label_ids); } catch { emailMeta.label_ids = []; }
    }
  } catch {
    // use defaults
  }

  const isStarredByGmail = emailMeta.label_ids?.includes("STARRED");
  const isImportant = emailMeta.label_ids?.includes("IMPORTANT");
  const isDraft = emailMeta.label_ids?.includes("DRAFT");

  // Initialise star state from Gmail label on first render
  const [starred, setStarred] = useState(() => isStarredByGmail);

  const handleToggle = () => {
    if (!expanded && !bodyData) {
      onExpandEmail(messageId);
    }
    setExpanded(!expanded);
  };

  const replySubject = emailMeta.subject.startsWith("Re:")
    ? emailMeta.subject
    : `Re: ${emailMeta.subject}`;
  const replyTo = isOutbound ? emailMeta.to : emailMeta.from_email;

  const hasAttachments = bodyData && bodyData.attachments.length > 0;

  return (
    <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[85%] w-full group/email">
        <div
          className={`rounded-xl border overflow-hidden transition-shadow ${
            isOutbound
              ? "bg-blue-500/5 border-blue-500/20 shadow-blue-500/5"
              : "bg-zinc-100/80 border-zinc-300/50 shadow-zinc-900/20"
          } ${expanded ? "shadow-lg" : "shadow-sm hover:shadow-md"}`}
        >
          {/* Compact header — always visible */}
          <button
            onClick={handleToggle}
            className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                isOutbound
                  ? "bg-blue-500/20 text-blue-700"
                  : "bg-zinc-200 text-zinc-700"
              }`}>
                {(emailMeta.from_name || emailMeta.from_email || "?")
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-zinc-900 truncate">
                    {isOutbound
                      ? `To: ${emailMeta.to}`
                      : emailMeta.from_name || emailMeta.from_email}
                  </span>
                  <span className="text-[10px] text-zinc-600 shrink-0 tabular-nums">
                    {formatServerShortDateTime(timestamp)}
                  </span>
                  <div className="flex items-center gap-1 ml-auto shrink-0">
                    {hasAttachments && !expanded && (
                      <Paperclip className="w-3 h-3 text-zinc-600" />
                    )}
                    {expanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-zinc-600" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />
                    )}
                  </div>
                </div>
                <p className="text-sm text-zinc-900 truncate font-medium">
                  {emailMeta.subject}
                </p>
                {!expanded && (
                  <p className="text-xs text-zinc-600 mt-1 line-clamp-1">
                    {snippet}
                  </p>
                )}
                {/* Gmail label badges */}
                {!expanded && (isDraft || isImportant || starred) && (
                  <div className="flex items-center gap-1 mt-1">
                    {isDraft && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/20 text-amber-700 border border-amber-500/30">
                        Draft
                      </span>
                    )}
                    {isImportant && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-yellow-500/20 text-yellow-700 border border-yellow-500/30">
                        Important
                      </span>
                    )}
                    {starred && (
                      <Star className="w-3 h-3 fill-amber-400 text-amber-700" />
                    )}
                  </div>
                )}
              </div>
            </div>
          </button>

          {/* Expanded body */}
          {expanded && (
            <div className="border-t border-zinc-300/50">
              {bodyLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 text-blue-700 animate-spin mr-2" />
                  <span className="text-sm text-zinc-600">
                    Fetching from Gmail...
                  </span>
                </div>
              ) : bodyData?.deleted ? (
                <div className="flex items-start gap-3 p-3">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-700">
                      {(bodyData as any).auth_error ? "Gmail authorization required" : "Email no longer available"}
                    </p>
                    <p className="text-xs text-zinc-600 mt-0.5">
                      {bodyData.error || "This email has been deleted from Gmail."}
                    </p>
                    {(bodyData as any).auth_error && (
                      <a
                        href="/app/excom-channel-account"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-xs text-blue-700 hover:text-blue-700 underline"
                      >
                        Re-authorize email account →
                      </a>
                    )}
                    <button
                      onClick={() => {
                        // Clear cached error so fetch is retried
                        if (typeof onRetryFetch === "function") onRetryFetch(messageId);
                      }}
                      className="block mt-1.5 text-xs text-zinc-600 hover:text-zinc-700 underline"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              ) : bodyData ? (
                <div>
                  {/* Email metadata — From, To, CC, Date */}
                  <div className="px-3 py-2.5 bg-zinc-100/40 text-xs space-y-1 border-b border-zinc-300/30">
                    <div className="flex items-start gap-2">
                      <span className="text-zinc-600 w-10 shrink-0 text-right">From</span>
                      <span className="text-zinc-700">
                        {bodyData.from_name ? (
                          <>
                            <span className="font-medium">{bodyData.from_name}</span>
                            <span className="text-zinc-600 ml-1">&lt;{bodyData.from_email}&gt;</span>
                          </>
                        ) : bodyData.from_email}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-zinc-600 w-10 shrink-0 text-right">To</span>
                      <span className="text-zinc-700">{bodyData.to}</span>
                    </div>
                    {bodyData.cc && (
                      <div className="flex items-start gap-2">
                        <span className="text-zinc-600 w-10 shrink-0 text-right">Cc</span>
                        <span className="text-zinc-700">{bodyData.cc}</span>
                      </div>
                    )}
                    {bodyData.date && (
                      <div className="flex items-start gap-2">
                        <span className="text-zinc-600 w-10 shrink-0 text-right">Date</span>
                        <span className="text-zinc-600">{bodyData.date}</span>
                      </div>
                    )}
                  </div>

                  {/* Action toolbar */}
                  <div className="flex items-center gap-1 px-3 py-2 border-b border-zinc-300/30">
                    {onReplyEmail && (
                      <>
                        <button
                          onClick={() => onReplyEmail(emailMeta.gmail_message_id, replySubject, replyTo)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-zinc-700 hover:bg-zinc-200/60 hover:text-zinc-900 transition-colors"
                        >
                          <Reply className="w-3.5 h-3.5" />
                          Reply
                        </button>
                        <button
                          onClick={() => {
                            const allRecipients = [emailMeta.to, emailMeta.from_email, bodyData.cc].filter(Boolean).join(", ");
                            onReplyEmail(emailMeta.gmail_message_id, replySubject, allRecipients);
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-zinc-700 hover:bg-zinc-200/60 hover:text-zinc-900 transition-colors"
                        >
                          <ReplyAll className="w-3.5 h-3.5" />
                          Reply All
                        </button>
                        <button
                          onClick={() => {
                            const fwdSubject = emailMeta.subject.startsWith("Fwd:")
                              ? emailMeta.subject
                              : `Fwd: ${emailMeta.subject}`;
                            onReplyEmail(emailMeta.gmail_message_id, fwdSubject, "");
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-zinc-700 hover:bg-zinc-200/60 hover:text-zinc-900 transition-colors"
                        >
                          <Forward className="w-3.5 h-3.5" />
                          Forward
                        </button>
                      </>
                    )}
                    <div className="flex-1" />
                    <button
                      onClick={() => setStarred(!starred)}
                      className={`p-1.5 rounded-md transition-colors ${
                        starred
                          ? "text-amber-700 bg-amber-500/10"
                          : "text-zinc-600 hover:text-amber-700 hover:bg-zinc-200/40"
                      }`}
                      title={starred ? "Unstar" : "Star"}
                    >
                      <Star className={`w-3.5 h-3.5 ${starred ? "fill-amber-400" : ""}`} />
                    </button>
                    <button
                      onClick={() => {
                        const w = window.open("", "_blank");
                        if (w) {
                          w.document.write(bodyData.body_html || `<pre>${bodyData.body_text}</pre>`);
                          w.document.close();
                          w.print();
                        }
                      }}
                      className="p-1.5 rounded-md text-zinc-600 hover:text-zinc-700 hover:bg-zinc-200/40 transition-colors"
                      title="Open in new tab / Print"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setShowHeaders(!showHeaders)}
                      className={`px-2 py-1 rounded-md text-[10px] transition-colors ${
                        showHeaders
                          ? "bg-zinc-200/80 text-zinc-900"
                          : "text-zinc-600 hover:text-zinc-700 hover:bg-zinc-200/40"
                      }`}
                      title="Show original headers"
                    >
                      Headers
                    </button>
                  </div>

                  {/* Original headers panel */}
                  {showHeaders && (
                    <div className="mx-4 mb-2 p-3 rounded-lg bg-zinc-50/60 border border-zinc-300/40 text-[10px] font-mono text-zinc-600 space-y-0.5 max-h-40 overflow-y-auto">
                      {bodyData.from_email && <div><span className="text-zinc-600">From:</span> {bodyData.from_name ? `${bodyData.from_name} <${bodyData.from_email}>` : bodyData.from_email}</div>}
                      {bodyData.to && <div><span className="text-zinc-600">To:</span> {bodyData.to}</div>}
                      {bodyData.cc && <div><span className="text-zinc-600">Cc:</span> {bodyData.cc}</div>}
                      {bodyData.date && <div><span className="text-zinc-600">Date:</span> {bodyData.date}</div>}
                      {emailMeta.message_id_header && <div><span className="text-zinc-600">Message-ID:</span> {emailMeta.message_id_header}</div>}
                      {emailMeta.in_reply_to && <div><span className="text-zinc-600">In-Reply-To:</span> {emailMeta.in_reply_to}</div>}
                      {emailMeta.label_ids?.length > 0 && <div><span className="text-zinc-600">Labels:</span> {emailMeta.label_ids.join(", ")}</div>}
                    </div>
                  )}

                  {/* Email body */}
                  <div className="p-3">
                    {bodyData.body_html ? (
                      <EmailBodyFrame html={bodyData.body_html} />
                    ) : (
                      <pre className="text-sm text-zinc-900 whitespace-pre-wrap font-sans leading-relaxed">
                        {bodyData.body_text || "(Empty email)"}
                      </pre>
                    )}
                  </div>

                  {/* Attachments */}
                  {bodyData.attachments.length > 0 && (
                    <div className="px-3 pb-4 border-t border-zinc-300/30 pt-3">
                      <div className="flex items-center gap-2 mb-3">
                        <Paperclip className="w-3.5 h-3.5 text-zinc-600" />
                        <span className="text-xs font-medium text-zinc-700">
                          {bodyData.attachments.length} Attachment{bodyData.attachments.length > 1 ? "s" : ""}
                        </span>
                        <span className="text-[10px] text-zinc-600">
                          ({formatBytes(bodyData.attachments.reduce((s, a) => s + a.size, 0))} total)
                        </span>
                      </div>
                      <div className="grid gap-2">
                        {bodyData.attachments.map((att, i) => (
                          <AttachmentCard
                            key={i}
                            attachment={att}
                            messageId={messageId}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center py-10">
                  <span className="text-sm text-zinc-600">
                    Click to load email content
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`flex items-center gap-1.5 mt-1 text-xs ${
            isOutbound ? "justify-end" : "justify-start"
          }`}
        >
          <Badge className="text-[9px] px-1.5 h-4 bg-zinc-100 text-zinc-600 border-zinc-300">
            <Mail className="w-2.5 h-2.5 mr-0.5" />
            Email
          </Badge>
          {sentBy && (
            <span className="text-[10px] text-zinc-600">{sentBy.name}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function AttachmentCard({
  attachment,
  messageId,
}: {
  attachment: EmailAttachment;
  messageId: string;
}) {
  const [downloading, setDownloading] = useState(false);
  const { icon: FileIcon, color, bg } = getFileIcon(attachment.mimeType, attachment.filename);

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

  const ext = attachment.filename.split(".").pop()?.toUpperCase() || "FILE";

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-zinc-300/50 bg-zinc-100/40 hover:bg-zinc-200/50 hover:border-zinc-300/60 transition-all group disabled:opacity-60 text-left w-full"
    >
      <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
        <FileIcon className={`w-5 h-5 ${color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-900 truncate font-medium group-hover:text-zinc-900 transition-colors">
          {attachment.filename}
        </p>
        <p className="text-[10px] text-zinc-600 mt-0.5">
          {ext} &middot; {formatBytes(attachment.size)}
        </p>
      </div>
      <div className="shrink-0">
        {downloading ? (
          <Loader2 className="w-4 h-4 text-blue-700 animate-spin" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-zinc-200/50 group-hover:bg-blue-500/20 flex items-center justify-center transition-colors">
            <Download className="w-4 h-4 text-zinc-600 group-hover:text-blue-700 transition-colors" />
          </div>
        )}
      </div>
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
