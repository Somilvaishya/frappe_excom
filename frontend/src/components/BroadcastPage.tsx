import { useState, useEffect, useCallback, useRef } from "react";
import { useFrappePostCall, useFrappeFileUpload } from "frappe-react-sdk";
import {
  ArrowLeft,
  Plus,
  Search,
  Radio,
  Send,
  Loader2,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Mail,
  MessageSquare,
  FileText,
  Eye,
  Users,
  Image as ImageIcon,
  Paperclip,
  Upload,
  Trash2,
  X,
  BarChart3,
  TrendingUp,
  MousePointerClick,
  UserX,
  Timer,
  Activity,
  Settings2,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { DateTimePicker } from "./ui/date-time-picker";
import { toast } from "sonner";

interface BroadcastItem {
  name: string;
  broadcast_name: string;
  subscriber_list: string;
  subscriber_list_name: string;
  channel: string;
  status: string;
  docstatus: number;
  wa_template: string;
  email_subject: string;
  scheduled_at?: string | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  creation: string;
  modified: string;
}

interface BroadcastLog {
  omni_identity: string;
  display_name: string;
  status: string;
  recipient_address: string;
  error_message: string;
  sent_at: string;
  creation: string;
}

interface SubscriberListOption {
  name: string;
  list_name: string;
  active_subscribers: number;
}

interface TemplateButton {
  button_type: string;
  button_label: string;
  website_url?: string;
  url_type?: string;
  example_url?: string;
  phone_number?: string;
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
  buttons: TemplateButton[];
  has_dynamic_url: boolean;
  available_languages: string[];
}

interface SubscriberField {
  value: string;
  label: string;
}

/** Matches Excom Broadcast.wa_variable_slots JSON (server: kind literal | subscriber_field). */
type WaVariableSlotKind = "literal" | "subscriber_field";

interface WaVariableSlotState {
  kind: WaVariableSlotKind;
  /** Used when kind === "literal" */
  value: string;
  /** subscriber_variable_fields value when kind === "subscriber_field" */
  field: string;
}

function emptyVariableSlots(count: number): WaVariableSlotState[] {
  return Array.from({ length: count }, () => ({
    kind: "literal",
    value: "",
    field: "",
  }));
}

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: typeof Clock }> = {
  Draft: { bg: "bg-zinc-300/10", text: "text-zinc-600", icon: Clock },
  Scheduled: { bg: "bg-violet-500/10", text: "text-violet-700", icon: Timer },
  Queued: { bg: "bg-blue-500/10", text: "text-blue-700", icon: Clock },
  Sending: { bg: "bg-amber-500/10", text: "text-amber-700", icon: Loader2 },
  Completed: { bg: "bg-green-500/10", text: "text-green-700", icon: CheckCircle2 },
  "Partially Failed": { bg: "bg-orange-500/10", text: "text-orange-700", icon: AlertTriangle },
  Failed: { bg: "bg-red-500/10", text: "text-red-700", icon: XCircle },
};

const HEADER_ACCEPT: Record<string, string> = {
  IMAGE: "image/jpeg,image/png,image/webp",
  DOCUMENT: "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.Draft;
  const Icon = style.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      <Icon className={`w-3 h-3 ${status === "Sending" ? "animate-spin" : ""}`} />
      {status}
    </span>
  );
}

function ChannelIcon({ channel }: { channel: string }) {
  if (channel === "WhatsApp") return <MessageSquare className="w-4 h-4 text-green-700" />;
  return <Mail className="w-4 h-4 text-blue-700" />;
}

function formatDuration(seconds: number): string {
  if (!seconds) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function localDatetimeInputMin(): string {
  const n = new Date();
  const p = (x: number) => String(x).padStart(2, "0");
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}T${p(n.getHours())}:${p(n.getMinutes())}`;
}

/** Frappe Datetime parse (site timezone) from browser datetime-local value. */
function frappeDatetimeFromLocalInput(dt: string): string {
  if (!dt.trim()) return "";
  const [d, t] = dt.split("T");
  if (!d || !t) return "";
  const hm = t.slice(0, 5);
  return `${d} ${hm}:00`;
}

interface MetricsData {
  broadcast_name: string;
  channel: string;
  status: string;
  time_windows: number[];
  delivery_funnel: {
    total_recipients: number; sent: number; delivered: number; read: number;
    sent_rate: number; delivered_rate: number; read_rate: number;
    failed: number; failed_rate: number;
  };
  response_by_window: { window_hours: number; window_label: string; count: number; rate: number }[];
  button_clicks: { button_text: string; click_count: number; rate: number }[];
  reply_quality: {
    text_replies: number; button_only: number; no_response: number;
    text_reply_rate: number; button_only_rate: number; no_response_rate: number;
  };
  optout: { count: number; rate: number };
  summary: { engagement_rate: number; avg_response_time_seconds: number; best_performing_cta: string | null };
}

function FunnelBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-zinc-600">{label}</span>
        <span className="text-zinc-700 font-medium">{value} ({pct.toFixed(1)}%)</span>
      </div>
      <div className="h-2.5 bg-zinc-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, sub, color = "text-zinc-900" }: {
  icon: any; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-200">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-zinc-600 font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-zinc-600 mt-0.5">{sub}</div>}
    </div>
  );
}

function AnalyticsPanel({ broadcastName }: { broadcastName: string }) {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [customWindows, setCustomWindows] = useState("");
  const [editingWindows, setEditingWindows] = useState(false);

  const { call: fetchMetrics } = useFrappePostCall(
    "excom.excom.services.broadcast_metrics.get_broadcast_metrics"
  );

  const load = useCallback(async (tw?: string) => {
    setLoading(true);
    try {
      const res = await fetchMetrics({ broadcast_name: broadcastName, time_windows: tw || customWindows });
      setMetrics((res as any)?.message || null);
    } catch {
      toast.error("Failed to load metrics");
    } finally {
      setLoading(false);
    }
  }, [fetchMetrics, broadcastName, customWindows]);

  useEffect(() => { load(); }, [broadcastName, load]);

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-700 animate-spin" />
      </div>
    );
  }

  if (!metrics) return null;

  const { delivery_funnel: df, response_by_window: rw, button_clicks: bc, reply_quality: rq, optout, summary } = metrics;

  return (
    <div className="p-4 space-y-4 overflow-y-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon={Activity} label="Engagement" value={`${summary.engagement_rate}%`} sub="Replies + Clicks / Sent" color="text-emerald-700" />
        <MetricCard icon={Timer} label="Avg Response" value={formatDuration(summary.avg_response_time_seconds)} sub="Time to first reply" color="text-blue-700" />
        <MetricCard icon={MousePointerClick} label="Best CTA" value={summary.best_performing_cta || "—"} sub="Most clicked button" color="text-purple-700" />
        <MetricCard icon={UserX} label="Opt-outs" value={optout.count} sub={`${optout.rate}% of sent`} color="text-red-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-zinc-50/50 rounded-xl p-4 border border-zinc-200">
          <h3 className="text-sm font-semibold text-zinc-900 mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-700" /> Delivery Funnel
          </h3>
          <div className="space-y-3">
            <FunnelBar label="Sent" value={df.sent} total={df.total_recipients} color="bg-blue-500" />
            <FunnelBar label="Delivered" value={df.delivered} total={df.sent} color="bg-emerald-500" />
            <FunnelBar label="Read" value={df.read} total={df.delivered} color="bg-purple-500" />
            <FunnelBar label="Failed" value={df.failed} total={df.total_recipients} color="bg-red-500" />
          </div>
        </div>

        <div className="bg-zinc-50/50 rounded-xl p-4 border border-zinc-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-700" /> Response by Time Window
            </h3>
            <button
              onClick={() => setEditingWindows(!editingWindows)}
              className="p-1 rounded hover:bg-zinc-100 text-zinc-600 hover:text-zinc-700 transition-colors"
              title="Customize time windows"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          </div>
          {editingWindows && (
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="e.g. 1,3,6,12,24"
                value={customWindows}
                onChange={(e) => setCustomWindows(e.target.value)}
                className="flex-1 bg-zinc-100 border border-zinc-300 rounded-lg px-3 py-1.5 text-sm text-zinc-700 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => load(customWindows)}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-500"
              >
                Apply
              </button>
            </div>
          )}
          <div className="space-y-2">
            {rw.map((w) => (
              <div key={w.window_hours} className="flex items-center gap-3">
                <span className="text-xs text-zinc-600 w-20 shrink-0">{w.window_label}</span>
                <div className="flex-1 h-6 bg-zinc-100 rounded-lg overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-lg transition-all duration-700"
                    style={{ width: `${Math.min(w.rate, 100)}%` }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-zinc-900">
                    {w.count} ({w.rate}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {bc.length > 0 && (
          <div className="bg-zinc-50/50 rounded-xl p-4 border border-zinc-200">
            <h3 className="text-sm font-semibold text-zinc-900 mb-3 flex items-center gap-2">
              <MousePointerClick className="w-4 h-4 text-purple-700" /> CTA Button Clicks
            </h3>
            <div className="space-y-2">
              {bc.map((b, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-zinc-100/50">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-purple-500/20 text-purple-700 text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-sm text-zinc-700">{b.button_text}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-zinc-900">{b.click_count}</span>
                    <span className="text-xs text-zinc-600">{b.rate}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-zinc-50/50 rounded-xl p-4 border border-zinc-200">
          <h3 className="text-sm font-semibold text-zinc-900 mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-700" /> Reply Quality
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-sm text-zinc-600">Text Replies</span>
              </div>
              <span className="text-sm text-zinc-700 font-medium">{rq.text_replies} ({rq.text_reply_rate}%)</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <span className="text-sm text-zinc-600">Button Only</span>
              </div>
              <span className="text-sm text-zinc-700 font-medium">{rq.button_only} ({rq.button_only_rate}%)</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-zinc-300" />
                <span className="text-sm text-zinc-600">No Response</span>
              </div>
              <span className="text-sm text-zinc-700 font-medium">{rq.no_response} ({rq.no_response_rate}%)</span>
            </div>
            <div className="h-3 flex rounded-full overflow-hidden mt-2">
              {rq.text_reply_rate > 0 && <div className="bg-emerald-500" style={{ width: `${rq.text_reply_rate}%` }} />}
              {rq.button_only_rate > 0 && <div className="bg-purple-500" style={{ width: `${rq.button_only_rate}%` }} />}
              {rq.no_response_rate > 0 && <div className="bg-zinc-300" style={{ width: `${rq.no_response_rate}%` }} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BroadcastDetailView({
  broadcastName,
  onBack,
}: {
  broadcastName: string;
  onBack: () => void;
}) {
  const [detail, setDetail] = useState<any>(null);
  const [logs, setLogs] = useState<BroadcastLog[]>([]);
  const [logFilter, setLogFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"logs" | "analytics">("logs");

  const { call: fetchDetail } = useFrappePostCall("excom.excom.api.broadcast.get_broadcast_detail");
  const { call: fetchLogs } = useFrappePostCall("excom.excom.api.broadcast.get_broadcast_logs");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchDetail({ broadcast_name: broadcastName });
      const data = (res as any)?.message;
      setDetail(data);
      setLogs(data?.recent_logs || []);
    } catch {
      toast.error("Failed to load broadcast");
    } finally {
      setLoading(false);
    }
  }, [fetchDetail, broadcastName]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (
      !detail ||
      detail.status === "Sending" ||
      detail.status === "Scheduled" ||
      detail.status === "Queued"
    ) {
      const interval = setInterval(load, 5000);
      return () => clearInterval(interval);
    }
  }, [detail, load]);

  const loadFilteredLogs = useCallback(async () => {
    try {
      const res = await fetchLogs({ broadcast_name: broadcastName, status: logFilter, limit: 200 });
      setLogs((res as any)?.message?.logs || []);
    } catch {}
  }, [fetchLogs, broadcastName, logFilter]);

  useEffect(() => {
    if (logFilter) loadFilteredLogs();
    else if (detail) setLogs(detail.recent_logs || []);
  }, [logFilter]);

  if (loading && !detail) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 text-blue-700 animate-spin" />
      </div>
    );
  }

  if (!detail) return null;

  const progress = detail.total_recipients > 0
    ? Math.round(((detail.sent_count + detail.failed_count) / detail.total_recipients) * 100)
    : 0;

  return (
    <div className="h-full w-full bg-white flex flex-col">
      <div className="shrink-0 px-4 py-3 border-b border-zinc-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <ChannelIcon channel={detail.channel} />
              <div>
                <h1 className="text-lg font-semibold text-zinc-900">{detail.broadcast_name}</h1>
                <p className="text-xs text-zinc-600">
                  {detail.subscriber_list} &middot; {new Date(detail.creation).toLocaleDateString()}
                  {detail.scheduled_at
                    ? ` · Sends ${new Date(detail.scheduled_at).toLocaleString()}`
                    : ""}
                </p>
              </div>
            </div>
          </div>
          <StatusBadge status={detail.status} />
        </div>

        <div className="grid grid-cols-4 gap-3 mt-4">
          <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
            <div className="text-2xl font-semibold text-zinc-900">{detail.total_recipients}</div>
            <div className="text-xs text-zinc-600">Recipients</div>
          </div>
          <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
            <div className="text-2xl font-semibold text-green-700">{detail.sent_count}</div>
            <div className="text-xs text-zinc-600">Sent</div>
          </div>
          <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
            <div className="text-2xl font-semibold text-red-700">{detail.failed_count}</div>
            <div className="text-xs text-zinc-600">Failed</div>
          </div>
          <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
            <div className="text-2xl font-semibold text-blue-700">{progress}%</div>
            <div className="text-xs text-zinc-600">Progress</div>
          </div>
        </div>

        {detail.status === "Sending" && (
          <div className="mt-3 h-2 bg-zinc-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-b border-zinc-200 flex items-center gap-3">
        <button
          onClick={() => setActiveTab("logs")}
          className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
            activeTab === "logs"
              ? "bg-zinc-100 text-zinc-900"
              : "text-zinc-600 hover:text-zinc-700"
          }`}
        >
          <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Delivery Log</span>
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
            activeTab === "analytics"
              ? "bg-zinc-100 text-zinc-900"
              : "text-zinc-600 hover:text-zinc-700"
          }`}
        >
          <span className="flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Analytics</span>
        </button>
        {activeTab === "logs" && (
          <select
            value={logFilter}
            onChange={(e) => setLogFilter(e.target.value)}
            className="ml-auto bg-zinc-50 border border-zinc-300 rounded-lg px-3 py-1.5 text-sm text-zinc-700 focus:outline-none"
          >
            <option value="">All</option>
            <option value="Sent">Sent</option>
            <option value="Failed">Failed</option>
            <option value="Skipped">Skipped</option>
          </select>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "analytics" ? (
          <AnalyticsPanel broadcastName={broadcastName} />
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Clock className="w-10 h-10 text-zinc-500 mb-2" />
            <p className="text-zinc-600 text-sm">
              {detail.status === "Draft"
                ? "Submit the broadcast to start sending"
                : detail.status === "Scheduled" && detail.scheduled_at
                  ? `Scheduled for ${new Date(detail.scheduled_at).toLocaleString()}`
                  : "No delivery logs yet"}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200 text-xs text-zinc-600 uppercase tracking-wider">
                <th className="text-left px-4 py-2">Recipient</th>
                <th className="text-left px-4 py-2">Address</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Error</th>
                <th className="text-left px-4 py-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, idx) => (
                <tr key={idx} className="border-b border-zinc-200/50 hover:bg-zinc-50/50">
                  <td className="px-4 py-2.5 text-sm text-zinc-900">{log.display_name || log.omni_identity}</td>
                  <td className="px-4 py-2.5 text-sm text-zinc-600">{log.recipient_address || "\u2014"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      log.status === "Sent" ? "bg-green-500/10 text-green-700" :
                      log.status === "Failed" ? "bg-red-500/10 text-red-700" :
                      "bg-zinc-300/10 text-zinc-600"
                    }`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-red-700 max-w-xs truncate">{log.error_message || "\u2014"}</td>
                  <td className="px-4 py-2.5 text-xs text-zinc-600">
                    {log.sent_at ? new Date(log.sent_at).toLocaleTimeString() : "\u2014"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ComposeDialog({
  onCreated,
  onClose,
}: {
  onCreated: (name: string) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [subscriberList, setSubscriberList] = useState("");
  const [channel, setChannel] = useState<"WhatsApp" | "Email">("WhatsApp");
  const [lists, setLists] = useState<SubscriberListOption[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);

  // WhatsApp
  const [waAccounts, setWaAccounts] = useState<
    { name: string; account_name: string; wa_phone_id?: string }[]
  >([]);
  const [waChannelAccount, setWaChannelAccount] = useState("");
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);
  const [templateSearch, setTemplateSearch] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [variableSlots, setVariableSlots] = useState<WaVariableSlotState[]>([]);
  const [buttonUrls, setButtonUrls] = useState<string[]>([]);
  const [subscriberFields, setSubscriberFields] = useState<SubscriberField[]>([]);
  const [headerMediaUrl, setHeaderMediaUrl] = useState("");
  const [headerFileName, setHeaderFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Email
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  /** Empty = send immediately after submit */
  const [scheduleAt, setScheduleAt] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const { call: fetchLists } = useFrappePostCall("excom.excom.api.broadcast.get_subscriber_lists_for_broadcast");
  const { call: fetchWaAccounts } = useFrappePostCall("excom.excom.api.chat.get_channel_accounts");
  const { call: fetchTemplates } = useFrappePostCall("excom.excom.api.chat.get_whatsapp_templates");
  const { call: fetchSubFields } = useFrappePostCall("excom.excom.api.chat.get_subscriber_variable_fields");
  const { call: createBroadcast } = useFrappePostCall("excom.excom.api.broadcast.create_broadcast");
  const { call: submitBroadcast } = useFrappePostCall("excom.excom.api.broadcast.submit_broadcast");
  const { upload } = useFrappeFileUpload();

  useEffect(() => {
    fetchLists({}).then((res) => {
      setLists((res as any)?.message || []);
    }).catch(() => toast.error("Failed to load subscriber lists"))
    .finally(() => setLoadingLists(false));
  }, []);

  const loadTemplates = useCallback(
    async (search: string = "") => {
      if (!waChannelAccount) {
        setTemplates([]);
        return;
      }
      try {
        const res = await fetchTemplates({ search, whatsapp_account: waChannelAccount });
        setTemplates((res as any)?.message || []);
      } catch {
        toast.error("Failed to load templates");
      }
    },
    [fetchTemplates, waChannelAccount]
  );

  useEffect(() => {
    if (step === 2 && channel === "WhatsApp") {
      if (waAccounts.length === 0) {
        fetchWaAccounts({ channel: "whatsapp" }).then((res) => {
          const accs = (res as any)?.message || [];
          setWaAccounts(accs);
          if (accs.length === 1) setWaChannelAccount(accs[0].name);
        }).catch(() => {});
      }
      if (subscriberFields.length === 0) {
        fetchSubFields({}).then((res) => {
          setSubscriberFields((res as any)?.message || []);
        }).catch(() => {});
      }
    }
  }, [step, channel, waAccounts.length, fetchWaAccounts, fetchSubFields]);

  useEffect(() => {
    if (!waChannelAccount) return;
    setSelectedTemplate(null);
    setVariableSlots([]);
    setHeaderMediaUrl("");
    setHeaderFileName("");
    setButtonUrls([]);
  }, [waChannelAccount]);

  useEffect(() => {
    if (step === 2 && channel === "WhatsApp" && waChannelAccount) {
      loadTemplates(templateSearch);
    }
  }, [step, channel, templateSearch, waChannelAccount, loadTemplates]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
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
  }, [upload]);

  const selectedListData = lists.find((l) => l.name === subscriberList);

  const needsMedia = selectedTemplate?.header_type === "IMAGE" || selectedTemplate?.header_type === "VIDEO" || selectedTemplate?.header_type === "DOCUMENT";

  const canProceedStep1 = name.trim() && subscriberList;
  const variableSlotsComplete =
    !selectedTemplate ||
    selectedTemplate.variable_count === 0 ||
    (variableSlots.length === selectedTemplate.variable_count &&
      variableSlots.every((slot) =>
        slot.kind === "literal"
          ? slot.value.trim() !== ""
          : slot.field.trim() !== ""
      ));

  const canProceedStep2 = channel === "WhatsApp"
    ? selectedTemplate && (!needsMedia || headerMediaUrl) && waChannelAccount && variableSlotsComplete
    : emailSubject.trim() && emailBody.trim();

  const getPreview = (): string => {
    if (!selectedTemplate) return "";
    let text = selectedTemplate.template || "";
    variableSlots.forEach((slot, i) => {
      if (slot.kind === "subscriber_field") {
        const sf = subscriberFields.find((f) => f.value === slot.field);
        text = text.replace(`{{${i + 1}}}`, sf ? `{${sf.label}}` : `{{${i + 1}}}`);
      } else {
        text = text.replace(`{{${i + 1}}}`, slot.value || `{{${i + 1}}}`);
      }
    });
    return text;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const scheduledAtFrappe = frappeDatetimeFromLocalInput(scheduleAt);

      const res = await createBroadcast({
        broadcast_name: name.trim(),
        subscriber_list: subscriberList,
        channel,
        wa_channel_account: channel === "WhatsApp" ? waChannelAccount : "",
        wa_template: channel === "WhatsApp" ? selectedTemplate?.name : "",
        wa_language_code: channel === "WhatsApp" ? selectedLanguage : "",
        wa_variable_mode: channel === "WhatsApp" ? "same_for_all" : "same_for_all",
        wa_variable_slots:
          channel === "WhatsApp"
            ? JSON.stringify(
                variableSlots.map((s) =>
                  s.kind === "literal"
                    ? { kind: "literal", value: s.value }
                    : { kind: "subscriber_field", field: s.field }
                )
              )
            : "",
        wa_template_variables: "[]",
        wa_variable_mapping: "[]",
        wa_header_media: channel === "WhatsApp" ? headerMediaUrl : "",
        wa_button_urls: channel === "WhatsApp" ? JSON.stringify(buttonUrls.filter(Boolean)) : "[]",
        email_subject: channel === "Email" ? emailSubject : "",
        email_body: channel === "Email" ? emailBody : "",
        scheduled_at: scheduledAtFrappe,
      });

      const bcName = (res as any)?.message?.name;
      if (!bcName) throw new Error("No broadcast name returned");

      await submitBroadcast({ broadcast_name: bcName });
      toast.success(
        scheduledAtFrappe
          ? "Broadcast scheduled — it will send at the time you chose"
          : "Broadcast submitted — sending started"
      );
      onCreated(bcName);
    } catch (err: any) {
      let msg = "Failed to create broadcast";
      try {
        if (err?._server_messages) {
          const parsed = JSON.parse(err._server_messages);
          if (typeof parsed?.[0] === "string") {
            const inner = JSON.parse(parsed[0]);
            msg = inner?.message || parsed[0];
          }
        }
      } catch {}
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const labels = selectedTemplate?.field_names
    ? selectedTemplate.field_names.split(",").map((s: string) => s.trim())
    : [];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-zinc-50 border border-zinc-300 rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 shrink-0">
          <div className="flex items-center gap-3">
            <Radio className="w-5 h-5 text-emerald-700" />
            <h2 className="text-lg font-semibold text-zinc-900">New Broadcast</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    s === step ? "bg-emerald-400" : s < step ? "bg-emerald-600" : "bg-zinc-200"
                  }`}
                />
              ))}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={selectedTemplate ? HEADER_ACCEPT[selectedTemplate.header_type] || "" : ""}
          onChange={handleFileUpload}
          className="hidden"
        />

        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="text-sm text-zinc-700 font-medium mb-2 block">Broadcast Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. March Promo Blast"
                  className="bg-zinc-100 border-zinc-300 text-zinc-900"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-sm text-zinc-700 font-medium mb-2 block">Subscriber List</label>
                {loadingLists ? (
                  <div className="flex items-center gap-2 text-zinc-600 text-sm py-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading lists...
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {lists.map((l) => (
                      <button
                        key={l.name}
                        onClick={() => setSubscriberList(l.name)}
                        className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${
                          subscriberList === l.name
                            ? "border-emerald-500/50 bg-emerald-500/10"
                            : "border-zinc-200 hover:border-zinc-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-zinc-900 font-medium">{l.list_name}</span>
                          <span className="text-xs text-zinc-600">
                            <Users className="w-3 h-3 inline mr-1" />
                            {l.active_subscribers} active
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm text-zinc-700 font-medium mb-2 block">Channel</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setChannel("WhatsApp")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border transition-all ${
                      channel === "WhatsApp"
                        ? "border-green-500/50 bg-green-500/10 text-green-700"
                        : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                    }`}
                  >
                    <MessageSquare className="w-5 h-5" />
                    <span className="text-sm font-medium">WhatsApp</span>
                  </button>
                  <button
                    onClick={() => setChannel("Email")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border transition-all ${
                      channel === "Email"
                        ? "border-blue-500/50 bg-blue-500/10 text-blue-700"
                        : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                    }`}
                  >
                    <Mail className="w-5 h-5" />
                    <span className="text-sm font-medium">Email</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 2 && channel === "WhatsApp" && (
            <div className="space-y-3">
              {waAccounts.length > 0 && (
                <div>
                  <label className="text-sm text-zinc-700 font-medium mb-1 block">
                    WhatsApp phone number
                  </label>
                  <p className="text-xs text-zinc-600 mb-2">
                    Choose the sender first. Only templates linked to this number in Excom (same
                    Business Account can use multiple numbers) appear below.
                  </p>
                  <div className="space-y-2">
                    {waAccounts.map((acc) => (
                      <button
                        key={acc.name}
                        type="button"
                        onClick={() => setWaChannelAccount(acc.name)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                          waChannelAccount === acc.name
                            ? "border-green-500/50 bg-green-500/10"
                            : "border-zinc-200 hover:border-zinc-300"
                        }`}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm text-zinc-900">{acc.account_name || acc.name}</span>
                          {acc.wa_phone_id ? (
                            <span className="text-[11px] text-zinc-600 font-mono">
                              Phone number ID · {acc.wa_phone_id}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!waChannelAccount && waAccounts.length > 0 ? (
                <p className="text-sm text-amber-700/90 text-center py-8 border border-dashed border-zinc-300 rounded-lg">
                  Select a WhatsApp account above to load templates for that number.
                </p>
              ) : !selectedTemplate ? (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                    <Input
                      placeholder="Search templates..."
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                      className="pl-10 bg-zinc-100 border-zinc-300 text-zinc-900"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {(() => {
                      const seen = new Set<string>();
                      return templates.filter((t) => {
                        const key = t.actual_name || t.template_name;
                        if (seen.has(key)) return false;
                        seen.add(key);
                        return true;
                      }).map((t) => (
                        <button
                          key={t.name}
                          onClick={() => {
                            setSelectedTemplate(t);
                            setSelectedLanguage(t.language_code);
                            setVariableSlots(emptyVariableSlots(t.variable_count));
                            setHeaderMediaUrl("");
                            setHeaderFileName("");
                            const dynBtns = (t.buttons || []).filter(
                              (b) => b.button_type === "Visit Website" && b.url_type === "Dynamic"
                            );
                            setButtonUrls(new Array(dynBtns.length).fill(""));
                          }}
                          className="w-full text-left rounded-lg border border-zinc-200 p-3.5 hover:border-green-500/40 hover:bg-green-500/5 transition-all group"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium text-zinc-900 group-hover:text-green-700">{t.template_name}</span>
                            <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-green-700" />
                          </div>
                          <p className="text-xs text-zinc-600 line-clamp-2 mb-2">{t.template || "No preview"}</p>
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-zinc-600">
                            <span className="bg-zinc-100 px-1.5 py-0.5 rounded">{t.category}</span>
                            {t.available_languages.length > 1 && (
                              <span className="text-cyan-700">{t.available_languages.length} languages</span>
                            )}
                            {t.variable_count > 0 && (
                              <span className="text-blue-700">{t.variable_count} variable{t.variable_count > 1 ? "s" : ""}</span>
                            )}
                            {t.header_type === "IMAGE" && (
                              <span className="text-purple-700 flex items-center gap-0.5"><ImageIcon className="w-3 h-3" /> Photo</span>
                            )}
                            {t.header_type === "DOCUMENT" && (
                              <span className="text-orange-700 flex items-center gap-0.5"><Paperclip className="w-3 h-3" /> Document</span>
                            )}
                            {t.has_dynamic_url && (
                              <span className="text-yellow-700">Dynamic URL</span>
                            )}
                          </div>
                        </button>
                      ));
                    })()}
                    {templates.length === 0 && (
                      <div className="text-center py-8 text-sm text-zinc-600">No approved templates found</div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setSelectedTemplate(null)}
                    className="text-xs text-zinc-600 hover:text-zinc-900 flex items-center gap-1"
                  >
                    <ChevronRight className="w-3 h-3 rotate-180" /> Change template
                  </button>

                  <div className="bg-zinc-100/50 border border-zinc-300 rounded-lg p-3">
                    <p className="text-xs text-zinc-600 mb-1 font-medium">{selectedTemplate.template_name}</p>
                    <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{getPreview()}</p>
                    {selectedTemplate.footer && (
                      <p className="text-[10px] text-zinc-600 mt-2 italic">{selectedTemplate.footer}</p>
                    )}
                  </div>

                  {/* Language selector */}
                  {selectedTemplate.available_languages.length > 1 && (
                    <div>
                      <label className="text-xs text-zinc-600 font-medium mb-1.5 block">Language</label>
                      <div className="flex flex-wrap gap-2">
                        {selectedTemplate.available_languages.map((lang) => (
                          <button
                            key={lang}
                            onClick={() => {
                              setSelectedLanguage(lang);
                              const match = templates.find(
                                (t) => (t.actual_name || t.template_name) === (selectedTemplate.actual_name || selectedTemplate.template_name) && t.language_code === lang
                              );
                              if (match && match.name !== selectedTemplate.name) {
                                setSelectedTemplate(match);
                                setVariableSlots(emptyVariableSlots(match.variable_count));
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              selectedLanguage === lang
                                ? "border-green-500/50 bg-green-500/10 text-green-700"
                                : "border-zinc-300 text-zinc-600 hover:border-zinc-300"
                            }`}
                          >
                            {lang}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Header media */}
                  {needsMedia && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {selectedTemplate.header_type === "IMAGE" ? (
                          <ImageIcon className="w-4 h-4 text-purple-700" />
                        ) : (
                          <Paperclip className="w-4 h-4 text-orange-700" />
                        )}
                        <p className="text-xs text-zinc-600 font-medium">
                          {selectedTemplate.header_type === "IMAGE" ? "Attach Header Image" : "Attach Header Document"}
                          <span className="text-red-700 ml-1">*</span>
                        </p>
                      </div>
                      {headerMediaUrl ? (
                        <div className="flex items-center gap-3 bg-zinc-100/70 border border-zinc-300 rounded-lg p-3">
                          {selectedTemplate.header_type === "IMAGE" ? (
                            <img src={headerMediaUrl} alt="Header" className="w-14 h-14 rounded-lg object-cover border border-zinc-300" />
                          ) : (
                            <div className="w-14 h-14 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                              <FileText className="w-6 h-6 text-orange-700" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-zinc-900 font-medium truncate">{headerFileName}</p>
                            <p className="text-[10px] text-green-700">Uploaded</p>
                          </div>
                          <button
                            onClick={() => { setHeaderMediaUrl(""); setHeaderFileName(""); }}
                            className="p-1.5 rounded-lg hover:bg-zinc-200 text-zinc-600 hover:text-red-700 shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className="w-full border-2 border-dashed border-zinc-300 hover:border-zinc-300 rounded-lg p-3 flex flex-col items-center gap-2 transition-colors group"
                        >
                          {uploading ? (
                            <Loader2 className="w-6 h-6 text-blue-700 animate-spin" />
                          ) : (
                            <Upload className="w-6 h-6 text-zinc-600 group-hover:text-zinc-700" />
                          )}
                          <span className="text-xs text-zinc-600 group-hover:text-zinc-700">
                            {uploading ? "Uploading..." :
                              selectedTemplate.header_type === "IMAGE" ? "Click to upload image" : "Click to upload document"}
                          </span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Variables — per-slot: same value for everyone vs subscriber field */}
                  {selectedTemplate.variable_count > 0 && (
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-zinc-600 font-medium">Template variables</p>
                        <p className="text-[11px] text-zinc-600 mt-1">
                          Choose for each <code className="text-zinc-600">{`{{1}}`}</code>,{" "}
                          <code className="text-zinc-600">{`{{2}}`}</code>, … whether the value is{" "}
                          <strong className="text-zinc-600">the same for everyone</strong> or{" "}
                          <strong className="text-zinc-600">different per subscriber</strong>.
                        </p>
                      </div>

                      {variableSlots.map((slot, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-zinc-300/80 bg-zinc-100/40 p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <label className="text-xs text-zinc-700 font-medium">
                              {labels[idx] || `Variable {{${idx + 1}}}`}
                            </label>
                            <div className="flex gap-1 bg-zinc-50 rounded-lg p-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...variableSlots];
                                  next[idx] = { kind: "literal", value: slot.value, field: "" };
                                  setVariableSlots(next);
                                }}
                                className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${
                                  slot.kind === "literal"
                                    ? "bg-zinc-200 text-zinc-900"
                                    : "text-zinc-600 hover:text-zinc-700"
                                }`}
                              >
                                Same for everyone
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...variableSlots];
                                  next[idx] = {
                                    kind: "subscriber_field",
                                    value: "",
                                    field: slot.field,
                                  };
                                  setVariableSlots(next);
                                }}
                                className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${
                                  slot.kind === "subscriber_field"
                                    ? "bg-zinc-200 text-zinc-900"
                                    : "text-zinc-600 hover:text-zinc-700"
                                }`}
                              >
                                Per subscriber
                              </button>
                            </div>
                          </div>

                          {slot.kind === "literal" ? (
                            <Input
                              placeholder={
                                selectedTemplate.sample_variables?.[idx] ||
                                `Value for {{${idx + 1}}}`
                              }
                              value={slot.value}
                              onChange={(e) => {
                                const next = [...variableSlots];
                                next[idx] = { ...next[idx], value: e.target.value };
                                setVariableSlots(next);
                              }}
                              className="bg-zinc-100 border-zinc-300 text-zinc-900"
                            />
                          ) : (
                            <select
                              value={slot.field}
                              onChange={(e) => {
                                const next = [...variableSlots];
                                next[idx] = { ...next[idx], field: e.target.value };
                                setVariableSlots(next);
                              }}
                              className="w-full bg-zinc-100 border border-zinc-300 rounded-lg px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:border-zinc-300"
                            >
                              <option value="">Select subscriber field…</option>
                              {subscriberFields.map((f) => (
                                <option key={f.value} value={f.value}>
                                  {f.label}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Dynamic button URLs */}
                  {selectedTemplate.has_dynamic_url && (() => {
                    const dynBtns = (selectedTemplate.buttons || []).filter(
                      (b) => b.button_type === "Visit Website" && b.url_type === "Dynamic"
                    );
                    return dynBtns.length > 0 ? (
                      <div className="space-y-3">
                        <p className="text-xs text-zinc-600 font-medium">Button Link Parameters</p>
                        {dynBtns.map((btn, idx) => (
                          <div key={idx}>
                            <label className="text-xs text-zinc-600 mb-1 block">
                              {btn.button_label} — <span className="text-zinc-500">{btn.website_url}</span>
                            </label>
                            <Input
                              placeholder={btn.example_url || "URL suffix value"}
                              value={buttonUrls[idx] || ""}
                              onChange={(e) => {
                                const next = [...buttonUrls];
                                next[idx] = e.target.value;
                                setButtonUrls(next);
                              }}
                              className="bg-zinc-100 border-zinc-300 text-zinc-900"
                            />
                          </div>
                        ))}
                      </div>
                    ) : null;
                  })()}
                </>
              )}
            </div>
          )}

          {step === 2 && channel === "Email" && (
            <div className="space-y-3">
              <div>
                <label className="text-sm text-zinc-700 font-medium mb-2 block">Subject</label>
                <Input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="e.g. Exciting news from us!"
                  className="bg-zinc-100 border-zinc-300 text-zinc-900"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm text-zinc-700 font-medium mb-2 block">Email Body</label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder={"Hello {{ subscriber.display_name }},\n\nWe have exciting news...\n\nBest regards"}
                  rows={10}
                  className="w-full bg-zinc-100 border border-zinc-300 rounded-lg px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-300 resize-none"
                />
                <p className="text-[10px] text-zinc-600 mt-1">
                  Supports Jinja: {"{{ subscriber.display_name }}"}, {"{{ customer.customer_name }}"}, etc.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="text-center mb-2">
                <h3 className="text-lg font-semibold text-zinc-900">Review & Send</h3>
                <p className="text-sm text-zinc-600">Confirm your broadcast details before sending</p>
              </div>

              <div className="bg-zinc-100/50 border border-zinc-300 rounded-lg divide-y divide-zinc-200/50">
                <div className="flex justify-between px-3 py-2">
                  <span className="text-sm text-zinc-600">Name</span>
                  <span className="text-sm text-zinc-900 font-medium">{name}</span>
                </div>
                <div className="flex justify-between px-3 py-2">
                  <span className="text-sm text-zinc-600">Subscriber List</span>
                  <span className="text-sm text-zinc-900">{selectedListData?.list_name || subscriberList}</span>
                </div>
                <div className="flex justify-between px-3 py-2">
                  <span className="text-sm text-zinc-600">Recipients</span>
                  <span className="text-sm text-emerald-700 font-medium">{selectedListData?.active_subscribers || "—"} active</span>
                </div>
                <div className="flex justify-between px-3 py-2">
                  <span className="text-sm text-zinc-600">Channel</span>
                  <span className="text-sm text-zinc-900 flex items-center gap-1.5">
                    <ChannelIcon channel={channel} /> {channel}
                  </span>
                </div>
                {channel === "WhatsApp" && waChannelAccount && (
                  <div className="flex justify-between px-3 py-2">
                    <span className="text-sm text-zinc-600">Account</span>
                    <span className="text-sm text-zinc-900">
                      {waAccounts.find((a) => a.name === waChannelAccount)?.account_name || waChannelAccount}
                    </span>
                  </div>
                )}
                {channel === "WhatsApp" && selectedTemplate && (
                  <>
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-sm text-zinc-600">Template</span>
                      <span className="text-sm text-zinc-900">{selectedTemplate.template_name}</span>
                    </div>
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-sm text-zinc-600">Language</span>
                      <span className="text-sm text-zinc-900">{selectedLanguage}</span>
                    </div>
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-sm text-zinc-600">Variables</span>
                      <span className="text-sm text-zinc-900 text-right">
                        {selectedTemplate.variable_count === 0
                          ? "None"
                          : (() => {
                              const same = variableSlots.filter((s) => s.kind === "literal").length;
                              const per = variableSlots.filter((s) => s.kind === "subscriber_field").length;
                              return `${same} same for everyone · ${per} per subscriber`;
                            })()}
                      </span>
                    </div>
                  </>
                )}
                {channel === "Email" && (
                  <div className="flex justify-between px-3 py-2">
                    <span className="text-sm text-zinc-600">Subject</span>
                    <span className="text-sm text-zinc-900">{emailSubject}</span>
                  </div>
                )}
                <div className="flex justify-between px-3 py-2">
                  <span className="text-sm text-zinc-600">Send time</span>
                  <span className="text-sm text-zinc-900">
                    {scheduleAt ? new Date(scheduleAt).toLocaleString() : "Immediately"}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-zinc-700 font-medium block">Schedule send (optional)</label>
                <p className="text-xs text-zinc-600">
                  Pick a future date and time in your local timezone, or leave empty to send as soon as you confirm.
                </p>
                <DateTimePicker
                  value={scheduleAt}
                  onChange={setScheduleAt}
                  min={localDatetimeInputMin()}
                  placeholder="Send immediately"
                />
              </div>

              {channel === "WhatsApp" && selectedTemplate && (
                <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                  <p className="text-xs text-green-700 font-medium mb-1">Template Preview</p>
                  {headerMediaUrl && (
                    <div className="mb-2">
                      {selectedTemplate.header_type === "IMAGE" ? (
                        <img src={headerMediaUrl} alt="Header" className="w-20 h-20 rounded-lg object-cover" />
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-zinc-600">
                          <FileText className="w-4 h-4" /> {headerFileName}
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-sm text-zinc-700 whitespace-pre-wrap">{getPreview()}</p>
                </div>
              )}

              <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-700 font-medium">This action cannot be undone</p>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    {scheduleAt
                      ? "At the scheduled time, Excom will send to all active subscribers on the list."
                      : "The broadcast will be sent immediately to all active subscribers in the list."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-3 p-4 border-t border-zinc-200 shrink-0">
          <Button
            variant="outline"
            onClick={() => {
              if (step === 1) onClose();
              else setStep((step - 1) as 1 | 2);
            }}
            className="border-zinc-300 text-zinc-700"
          >
            {step === 1 ? "Cancel" : "Back"}
          </Button>

          {step < 3 ? (
            <Button
              disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
              onClick={() => setStep((step + 1) as 2 | 3)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-32"
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              disabled={submitting}
              onClick={handleSubmit}
              className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white min-w-40"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {scheduleAt ? <Timer className="w-4 h-4 mr-1.5" /> : <Send className="w-4 h-4 mr-1.5" />}
                  {scheduleAt ? "Schedule broadcast" : "Send broadcast"}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function BroadcastPage({ onNavigateBack }: { onNavigateBack: () => void }) {
  const [viewMode, setViewMode] = useState<"list" | "detail">("list");
  const [selectedBroadcast, setSelectedBroadcast] = useState<string | null>(null);
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [showCompose, setShowCompose] = useState(false);
  const [loading, setLoading] = useState(true);

  const { call: fetchBroadcasts } = useFrappePostCall("excom.excom.api.broadcast.get_broadcasts");

  const loadBroadcasts = useCallback(async () => {
    try {
      const res = await fetchBroadcasts({
        search: searchQuery,
        status: statusFilter,
        channel: channelFilter,
      });
      setBroadcasts((res as any)?.message?.broadcasts || []);
    } catch {
      toast.error("Failed to load broadcasts");
    } finally {
      setLoading(false);
    }
  }, [fetchBroadcasts, searchQuery, statusFilter, channelFilter]);

  useEffect(() => { loadBroadcasts(); }, [loadBroadcasts]);

  if (viewMode === "detail" && selectedBroadcast) {
    return (
      <BroadcastDetailView
        broadcastName={selectedBroadcast}
        onBack={() => {
          setViewMode("list");
          setSelectedBroadcast(null);
          loadBroadcasts();
        }}
      />
    );
  }

  return (
    <div className="h-full w-full bg-white flex flex-col">
      <div className="shrink-0 px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateBack}
            className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Radio className="w-5 h-5 text-emerald-700" />
          <h1 className="text-lg font-semibold text-zinc-900">Broadcasts</h1>
        </div>
        <Button
          onClick={() => setShowCompose(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          New Broadcast
        </Button>
      </div>

      <div className="px-4 py-2 border-b border-zinc-200 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search broadcasts..."
            className="pl-9 bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-600"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-zinc-50 border border-zinc-300 rounded-lg px-3 py-2 text-sm text-zinc-700 focus:outline-none"
        >
          <option value="">All Status</option>
          <option value="Draft">Draft</option>
          <option value="Scheduled">Scheduled</option>
          <option value="Queued">Queued</option>
          <option value="Sending">Sending</option>
          <option value="Completed">Completed</option>
          <option value="Failed">Failed</option>
        </select>
        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
          className="bg-zinc-50 border border-zinc-300 rounded-lg px-3 py-2 text-sm text-zinc-700 focus:outline-none"
        >
          <option value="">All Channels</option>
          <option value="WhatsApp">WhatsApp</option>
          <option value="Email">Email</option>
        </select>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 text-emerald-700 animate-spin" />
          </div>
        ) : broadcasts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Radio className="w-12 h-12 text-zinc-500 mb-3" />
            <p className="text-zinc-600 text-sm">No broadcasts yet</p>
            <p className="text-zinc-600 text-xs mt-1">Create your first broadcast to reach your subscribers</p>
            <Button
              onClick={() => setShowCompose(true)}
              className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Broadcast
            </Button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200 text-xs text-zinc-600 uppercase tracking-wider">
                <th className="text-left px-4 py-2">Broadcast</th>
                <th className="text-left px-4 py-2">Channel</th>
                <th className="text-left px-4 py-2">List</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">Sent / Total</th>
                <th className="text-right px-4 py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {broadcasts.map((bc) => (
                <tr
                  key={bc.name}
                  onClick={() => { setSelectedBroadcast(bc.name); setViewMode("detail"); }}
                  className="border-b border-zinc-200/50 hover:bg-zinc-50/50 transition-colors cursor-pointer group"
                >
                  <td className="px-4 py-2">
                    <span className="text-sm text-zinc-900 font-medium group-hover:text-emerald-700 transition-colors">
                      {bc.broadcast_name}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      <ChannelIcon channel={bc.channel} />
                      <span className="text-sm text-zinc-600">{bc.channel}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-sm text-zinc-600">{bc.subscriber_list_name || bc.subscriber_list}</td>
                  <td className="px-4 py-2"><StatusBadge status={bc.status} /></td>
                  <td className="px-4 py-2 text-right">
                    <span className="text-sm text-zinc-700">
                      {bc.sent_count}
                      {bc.failed_count > 0 && <span className="text-red-700"> (+{bc.failed_count} failed)</span>}
                      <span className="text-zinc-600"> / {bc.total_recipients}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-xs text-zinc-600">
                    {bc.status === "Scheduled" && bc.scheduled_at
                      ? new Date(bc.scheduled_at).toLocaleString()
                      : new Date(bc.creation).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCompose && (
        <ComposeDialog
          onCreated={(bcName) => {
            setShowCompose(false);
            setSelectedBroadcast(bcName);
            setViewMode("detail");
          }}
          onClose={() => setShowCompose(false)}
        />
      )}
    </div>
  );
}
