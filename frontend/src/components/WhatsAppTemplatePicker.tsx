import { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  Search,
  FileText,
  Send,
  Loader2,
  Clock,
  AlertTriangle,
  ChevronRight,
  Image as ImageIcon,
  Paperclip,
  Upload,
  Trash2,
} from "lucide-react";
import { useFrappePostCall, useFrappeFileUpload } from "frappe-react-sdk";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "sonner";

interface WhatsAppTemplatePickerProps {
  threadId: string;
  onClose: () => void;
  onSent: () => void;
}

interface TemplateItem {
  name: string;
  template_name: string;
  actual_name: string;
  template: string;
  language_code: string;
  category: string;
  header_type: string;
  header: string;
  footer: string;
  sample_values: string;
  field_names: string;
  variable_count: number;
  sample_variables: string[];
}

interface WindowInfo {
  window_open: boolean;
  last_inbound_at: string | null;
  hours_remaining: number;
}

const HEADER_ACCEPT: Record<string, string> = {
  IMAGE: "image/jpeg,image/png,image/webp",
  DOCUMENT: "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export function WhatsAppTemplatePicker({
  threadId,
  onClose,
  onSent,
}: WhatsAppTemplatePickerProps) {
  const [step, setStep] = useState<"list" | "fill">("list");
  const [searchText, setSearchText] = useState("");
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);
  const [variables, setVariables] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [windowInfo, setWindowInfo] = useState<WindowInfo | null>(null);

  const [headerMediaUrl, setHeaderMediaUrl] = useState("");
  const [headerFileName, setHeaderFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const { call: fetchTemplates } = useFrappePostCall(
    "excom.excom.api.chat.get_whatsapp_templates"
  );
  const { call: sendTemplate } = useFrappePostCall(
    "excom.excom.api.chat.send_template_to_thread"
  );
  const { call: checkWindow } = useFrappePostCall(
    "excom.excom.api.chat.check_24h_window"
  );
  const { upload } = useFrappeFileUpload();

  const loadTemplates = useCallback(
    async (search: string = "") => {
      setLoading(true);
      try {
        const res = await fetchTemplates({ search });
        setTemplates((res as any)?.message || []);
      } catch {
        toast.error("Failed to load templates");
      } finally {
        setLoading(false);
      }
    },
    [fetchTemplates]
  );

  useEffect(() => {
    loadTemplates();
    checkWindow({ thread_id: threadId })
      .then((res) => {
        setWindowInfo((res as any)?.message || null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadTemplates(searchText), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchText, loadTemplates]);

  const handleSelectTemplate = (t: TemplateItem) => {
    setSelectedTemplate(t);
    setVariables(new Array(t.variable_count).fill(""));
    setHeaderMediaUrl("");
    setHeaderFileName("");
    setStep("fill");
  };

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const result = await upload(file, { isPrivate: false });
        setHeaderMediaUrl(result.file_url);
        setHeaderFileName(file.name);
        toast.success("File uploaded");
      } catch {
        toast.error("Upload failed");
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [upload]
  );

  const getPreview = (): string => {
    if (!selectedTemplate) return "";
    let text = selectedTemplate.template || "";
    variables.forEach((val, i) => {
      text = text.replace(`{{${i + 1}}}`, val || `{{${i + 1}}}`);
    });
    return text;
  };

  const needsMedia =
    selectedTemplate?.header_type === "IMAGE" ||
    selectedTemplate?.header_type === "DOCUMENT";

  const canSend = !sending && selectedTemplate && (!needsMedia || headerMediaUrl);

  const handleSend = async () => {
    if (!selectedTemplate) return;
    if (needsMedia && !headerMediaUrl) {
      toast.error(
        `Please attach a ${selectedTemplate.header_type === "IMAGE" ? "photo" : "document"} for this template`
      );
      return;
    }
    setSending(true);
    try {
      await sendTemplate({
        thread_id: threadId,
        template_name: selectedTemplate.name,
        variables: JSON.stringify(variables),
        header_media_url: headerMediaUrl,
      });
      toast.success("Template sent");
      onSent();
      onClose();
    } catch (err: any) {
      let msg = "Failed to send template";
      try {
        if (err?._server_messages) {
          const parsed = JSON.parse(err._server_messages);
          if (typeof parsed?.[0] === "string") {
            const inner = JSON.parse(parsed[0]);
            msg = inner?.message || parsed[0];
          }
        }
      } catch {
        // use default
      }
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const labels = selectedTemplate?.field_names
    ? selectedTemplate.field_names.split(",").map((s: string) => s.trim())
    : [];

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg shadow-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-green-400" />
            <h2 className="text-lg font-semibold text-white">
              {step === "list" ? "WhatsApp Templates" : "Fill Variables"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {windowInfo && (
          <div
            className={`shrink-0 px-5 py-2.5 text-xs flex items-center gap-2 border-b border-zinc-800 ${
              windowInfo.window_open
                ? "bg-green-500/10 text-green-400"
                : "bg-amber-500/10 text-amber-400"
            }`}
          >
            {windowInfo.window_open ? (
              <>
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>
                  24h window open &mdash; {windowInfo.hours_remaining}h remaining.
                  You can send free-form messages or templates.
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>24h window closed. Only approved templates can be sent.</span>
              </>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={selectedTemplate ? HEADER_ACCEPT[selectedTemplate.header_type] || "" : ""}
          onChange={handleFileUpload}
          className="hidden"
        />

        <div className="flex-1 min-h-0 overflow-y-auto">
          {step === "list" && (
            <div className="p-5 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input
                  placeholder="Search templates..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="pl-10 bg-zinc-800 border-zinc-700 text-white"
                  autoFocus
                />
              </div>

              {loading && (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 text-green-400 animate-spin" />
                </div>
              )}

              {!loading && templates.length === 0 && (
                <div className="text-center py-10 text-sm text-zinc-500">
                  No approved templates found
                </div>
              )}

              <div className="space-y-2">
                {templates.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => handleSelectTemplate(t)}
                    className="w-full text-left rounded-lg border border-zinc-800 p-3.5 hover:border-green-500/40 hover:bg-green-500/5 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-white group-hover:text-green-400 transition-colors">
                        {t.template_name}
                      </span>
                      <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-green-400 transition-colors" />
                    </div>
                    <p className="text-xs text-zinc-400 line-clamp-2 mb-2">
                      {t.template || "No preview available"}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                      <span className="bg-zinc-800 px-1.5 py-0.5 rounded">{t.category}</span>
                      <span>{t.language_code}</span>
                      {t.variable_count > 0 && (
                        <span className="text-blue-400">
                          {t.variable_count} variable{t.variable_count > 1 ? "s" : ""}
                        </span>
                      )}
                      {t.header_type === "IMAGE" && (
                        <span className="text-purple-400 flex items-center gap-0.5">
                          <ImageIcon className="w-3 h-3" /> Photo required
                        </span>
                      )}
                      {t.header_type === "DOCUMENT" && (
                        <span className="text-orange-400 flex items-center gap-0.5">
                          <Paperclip className="w-3 h-3" /> PDF/Doc required
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "fill" && selectedTemplate && (
            <div className="p-5 space-y-4">
              <button
                onClick={() => setStep("list")}
                className="text-xs text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
              >
                <ChevronRight className="w-3 h-3 rotate-180" />
                Back to templates
              </button>

              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
                <p className="text-xs text-zinc-400 mb-1 font-medium">
                  {selectedTemplate.template_name}
                </p>
                <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                  {getPreview()}
                </p>
                {selectedTemplate.footer && (
                  <p className="text-[10px] text-zinc-500 mt-2 italic">
                    {selectedTemplate.footer}
                  </p>
                )}
              </div>

              {needsMedia && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {selectedTemplate.header_type === "IMAGE" ? (
                      <ImageIcon className="w-4 h-4 text-purple-400" />
                    ) : (
                      <Paperclip className="w-4 h-4 text-orange-400" />
                    )}
                    <p className="text-xs text-zinc-400 font-medium">
                      {selectedTemplate.header_type === "IMAGE"
                        ? "Attach Header Image"
                        : "Attach Header Document (PDF)"}
                      <span className="text-red-400 ml-1">*</span>
                    </p>
                  </div>

                  {headerMediaUrl ? (
                    <div className="flex items-center gap-3 bg-zinc-800/70 border border-zinc-700 rounded-lg p-3">
                      {selectedTemplate.header_type === "IMAGE" ? (
                        <img
                          src={headerMediaUrl}
                          alt="Header"
                          className="w-14 h-14 rounded-lg object-cover border border-zinc-600"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                          <FileText className="w-6 h-6 text-orange-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">
                          {headerFileName}
                        </p>
                        <p className="text-[10px] text-green-400">Uploaded</p>
                      </div>
                      <button
                        onClick={() => {
                          setHeaderMediaUrl("");
                          setHeaderFileName("");
                        }}
                        className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-red-400 transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full border-2 border-dashed border-zinc-700 hover:border-zinc-500 rounded-lg p-4 flex flex-col items-center gap-2 transition-colors group"
                    >
                      {uploading ? (
                        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                      ) : (
                        <Upload className="w-6 h-6 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                      )}
                      <span className="text-xs text-zinc-500 group-hover:text-zinc-300 transition-colors">
                        {uploading
                          ? "Uploading..."
                          : selectedTemplate.header_type === "IMAGE"
                          ? "Click to upload image (JPEG, PNG, WebP)"
                          : "Click to upload document (PDF, DOC, XLS)"}
                      </span>
                    </button>
                  )}
                </div>
              )}

              {selectedTemplate.variable_count > 0 && (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-400 font-medium">
                    Fill in template variables:
                  </p>
                  {variables.map((val, idx) => (
                    <div key={idx}>
                      <label className="text-xs text-zinc-500 mb-1 block">
                        {labels[idx] || `Variable {{${idx + 1}}}`}
                      </label>
                      <Input
                        placeholder={
                          selectedTemplate.sample_variables[idx] ||
                          `Value for {{${idx + 1}}}`
                        }
                        value={val}
                        onChange={(e) => {
                          const next = [...variables];
                          next[idx] = e.target.value;
                          setVariables(next);
                        }}
                        className="bg-zinc-800 border-zinc-700 text-white"
                        autoFocus={idx === 0 && !needsMedia}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {step === "fill" && (
          <div className="flex justify-end gap-2 p-5 border-t border-zinc-800 shrink-0">
            <Button
              variant="outline"
              onClick={() => setStep("list")}
              className="border-zinc-700 text-zinc-300"
            >
              Back
            </Button>
            <Button
              disabled={!canSend}
              onClick={handleSend}
              className="bg-green-600 hover:bg-green-700 text-white min-w-28"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4 mr-1.5" />
                  Send Template
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
