import { useState } from "react";
import {
  Mail,
  ChevronDown,
  ChevronUp,
  Paperclip,
  Loader2,
  AlertTriangle,
  Reply,
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

                  {/* Email body */}
                  <div className="p-4">
                    {bodyData.body_html ? (
                      <div
                        className="text-sm text-zinc-200 prose prose-invert prose-sm max-w-none
                          [&_a]:text-blue-400 [&_img]:max-w-full [&_img]:rounded
                          [&_table]:text-xs [&_td]:p-1 [&_th]:p-1"
                        dangerouslySetInnerHTML={{ __html: bodyData.body_html }}
                      />
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
                          <div
                            key={i}
                            className="flex items-center gap-2 px-2 py-1.5 bg-zinc-700/50 rounded-lg text-xs"
                          >
                            <Paperclip className="w-3 h-3 text-zinc-400" />
                            <span className="text-zinc-300 truncate max-w-[150px]">
                              {att.filename}
                            </span>
                            <span className="text-zinc-500">
                              {formatBytes(att.size)}
                            </span>
                          </div>
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
