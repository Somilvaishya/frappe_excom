import { useState } from "react";
import { Send, X, Loader2 } from "lucide-react";
import { useFrappePostCall } from "frappe-react-sdk";
import { toast } from "sonner";

interface EmailComposeProps {
  threadId: string;
  defaultTo?: string;
  defaultSubject?: string;
  inReplyToGmailId?: string;
  onClose: () => void;
  onSent: () => void;
}

export function EmailCompose({
  threadId,
  defaultTo = "",
  defaultSubject = "",
  inReplyToGmailId = "",
  onClose,
  onSent,
}: EmailComposeProps) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [cc, setCc] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [showCc, setShowCc] = useState(false);

  const { call, loading } = useFrappePostCall(
    "excom.excom.api.email.send_email",
  );

  const handleSend = async () => {
    if (!to.trim() || !bodyHtml.trim()) {
      toast.error("Recipient and body are required");
      return;
    }

    try {
      await call({
        thread_id: threadId,
        to: to.trim(),
        subject: subject.trim() || "(No Subject)",
        body_html: bodyHtml,
        cc: cc.trim(),
        in_reply_to_gmail_id: inReplyToGmailId,
      });
      toast.success("Email sent");
      onSent();
      onClose();
    } catch (err) {
      toast.error("Failed to send email");
    }
  };

  return (
    <div className="border-t border-zinc-700 bg-zinc-900/90">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
        <span className="text-xs font-medium text-zinc-300">
          {inReplyToGmailId ? "Reply" : "New Email"}
        </span>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Fields */}
      <div className="px-4 py-2 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 w-12 shrink-0">To:</span>
          <input
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="recipient@example.com"
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder-zinc-600"
          />
          {!showCc && (
            <button
              onClick={() => setShowCc(true)}
              className="text-[10px] text-zinc-500 hover:text-zinc-300"
            >
              Cc
            </button>
          )}
        </div>

        {showCc && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 w-12 shrink-0">Cc:</span>
            <input
              type="text"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="cc@example.com"
              className="flex-1 bg-transparent text-sm text-white outline-none placeholder-zinc-600"
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 w-12 shrink-0">Subject:</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder-zinc-600"
          />
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pb-2">
        <textarea
          value={bodyHtml}
          onChange={(e) => setBodyHtml(e.target.value)}
          placeholder="Write your message..."
          rows={6}
          className="w-full bg-zinc-800/50 rounded-lg p-3 text-sm text-white outline-none resize-none placeholder-zinc-600 border border-zinc-700/50 focus:border-blue-500/30"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 px-4 pb-3">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
        >
          Discard
        </button>
        <button
          onClick={handleSend}
          disabled={loading || !to.trim() || !bodyHtml.trim()}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          Send
        </button>
      </div>
    </div>
  );
}
