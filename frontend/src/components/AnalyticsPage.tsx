import { useState, useMemo, useCallback, useEffect } from "react";
import {
  ArrowLeft,
  BarChart3,
  TrendingUp,
  MessageCircle,
  DollarSign,
  FileText,
  Clock,
  Users,
  Activity,
  RefreshCw,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { toast } from "sonner";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface AnalyticsPageProps {
  onNavigateBack: () => void;
}

type AnalyticsTab = "overview" | "messaging" | "conversations" | "pricing";
type Period = "7" | "14" | "30" | "90";

const PERIOD_LABELS: Record<Period, string> = {
  "7": "7 Days",
  "14": "14 Days",
  "30": "30 Days",
  "90": "90 Days",
};

const CATEGORY_COLORS: Record<string, string> = {
  MARKETING: "#8b5cf6",
  UTILITY: "#3b82f6",
  AUTHENTICATION: "#f59e0b",
  SERVICE: "#10b981",
  UNKNOWN: "#6b7280",
};

const CHART_COLORS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4"];

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color = "blue",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.FC<{ className?: string }>;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "from-blue-500/20 to-blue-600/10 border-blue-500/30",
    purple: "from-purple-500/20 to-purple-600/10 border-purple-500/30",
    green: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30",
    amber: "from-amber-500/20 to-amber-600/10 border-amber-500/30",
    rose: "from-rose-500/20 to-rose-600/10 border-rose-500/30",
  };
  return (
    <div className={`rounded-xl border bg-gradient-to-br p-4 ${colorMap[color] || colorMap.blue}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-zinc-400" />
        <span className="text-xs text-zinc-400 font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{typeof value === "number" ? formatNumber(value) : value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  );
}

export function AnalyticsPage({ onNavigateBack }: AnalyticsPageProps) {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("overview");
  const [period, setPeriod] = useState<Period>("30");
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState("");

  const { data: accountsData } = useFrappeGetCall<{ message: any[] }>(
    "excom.excom.api.analytics.get_wa_accounts"
  );
  const accounts = accountsData?.message ?? [];

  useEffect(() => {
    if (accounts.length > 0 && !selectedAccount) {
      setSelectedAccount(accounts[0].name);
    }
  }, [accounts, selectedAccount]);

  const overviewParams = useMemo(
    () => ({
      account_name: selectedAccount,
      days: parseInt(period),
    }),
    [selectedAccount, period]
  );

  const internalParams = useMemo(
    () => ({ days: parseInt(period) }),
    [period]
  );

  const { data: overviewData, isLoading: overviewLoading, mutate: refreshOverview } =
    useFrappeGetCall<{ message: any }>(
      "excom.excom.api.analytics.get_analytics_overview",
      selectedAccount ? overviewParams : undefined,
    );

  const { data: internalData, isLoading: internalLoading, mutate: refreshInternal } =
    useFrappeGetCall<{ message: any }>(
      "excom.excom.api.analytics.get_internal_metrics",
      internalParams,
    );

  const overview = overviewData?.message || {};
  const internal = internalData?.message || {};

  const handleRefresh = useCallback(() => {
    refreshOverview();
    refreshInternal();
    toast.success("Analytics refreshed");
  }, [refreshOverview, refreshInternal]);

  const messagingChartData = useMemo(() => {
    const points = overview?.messaging?.data_points || [];
    return points.map((dp: any) => ({
      date: formatDate(dp.start),
      sent: dp.sent || 0,
      delivered: dp.delivered || 0,
    }));
  }, [overview]);

  const internalDayData = useMemo(() => {
    const points = internal?.messages_by_day || [];
    const dayMap: Record<string, { day: string; inbound: number; outbound: number }> = {};
    for (const p of points) {
      if (!dayMap[p.day]) dayMap[p.day] = { day: p.day, inbound: 0, outbound: 0 };
      if (p.direction === "Inbound") dayMap[p.day].inbound = p.count;
      else dayMap[p.day].outbound = p.count;
    }
    return Object.values(dayMap).sort((a, b) => a.day.localeCompare(b.day)).map((d) => ({
      ...d,
      day: new Date(d.day).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    }));
  }, [internal]);

  const channelPieData = useMemo(() => {
    return (internal?.messages_by_channel || []).map((c: any) => ({
      name: c.channel ? c.channel.charAt(0).toUpperCase() + c.channel.slice(1) : "Unknown",
      value: c.count,
    }));
  }, [internal]);

  const categoryPieData = useMemo(() => {
    const cats = overview?.conversations?.by_category || {};
    return Object.entries(cats).map(([name, value]) => ({
      name: name.charAt(0) + name.slice(1).toLowerCase(),
      value: value as number,
      fill: CATEGORY_COLORS[name] || "#6b7280",
    }));
  }, [overview]);

  const typeBarData = useMemo(() => {
    return (internal?.messages_by_type || []).slice(0, 8).map((t: any) => ({
      type: t.message_type,
      count: t.count,
    }));
  }, [internal]);

  const isLoading = overviewLoading || internalLoading;

  const tabs: { id: AnalyticsTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "messaging", label: "Messages", icon: MessageCircle },
    { id: "conversations", label: "Conversations", icon: Users },
    { id: "pricing", label: "Costs", icon: DollarSign },
  ];

  return (
    <div className="h-full w-full bg-zinc-950 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onNavigateBack} className="text-zinc-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-400" />
                Analytics
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5">WhatsApp & platform metrics</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {accounts.length > 1 && (
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                {accounts.map((a: any) => (
                  <option key={a.name} value={a.name}>{a.account_name || a.name}</option>
                ))}
              </select>
            )}

            <div className="relative">
              <button
                onClick={() => setShowPeriodMenu(!showPeriodMenu)}
                className="flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white hover:border-zinc-600"
              >
                {PERIOD_LABELS[period]}
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              </button>
              {showPeriodMenu && (
                <div className="absolute right-0 top-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 py-1">
                  {(Object.entries(PERIOD_LABELS) as [Period, string][]).map(([k, v]) => (
                    <button
                      key={k}
                      onClick={() => { setPeriod(k); setShowPeriodMenu(false); }}
                      className={`w-full px-4 py-1.5 text-sm text-left hover:bg-zinc-700 ${period === k ? "text-blue-400" : "text-zinc-300"}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button variant="ghost" size="icon" onClick={handleRefresh} className="text-zinc-400 hover:text-white" disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === t.id
                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading && !overview.messaging && !internal.messages_by_day ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === "overview" && (
              <OverviewTab
                overview={overview}
                internal={internal}
                messagingChartData={messagingChartData}
                internalDayData={internalDayData}
                channelPieData={channelPieData}
                categoryPieData={categoryPieData}
                typeBarData={typeBarData}
              />
            )}
            {activeTab === "messaging" && (
              <MessagingTab
                overview={overview}
                internal={internal}
                messagingChartData={messagingChartData}
                internalDayData={internalDayData}
              />
            )}
            {activeTab === "conversations" && (
              <ConversationsTab
                overview={overview}
                internal={internal}
                categoryPieData={categoryPieData}
              />
            )}
            {activeTab === "pricing" && (
              <PricingTab overview={overview} />
            )}
          </>
        )}
      </div>
    </div>
  );
}


function OverviewTab({
  overview,
  internal,
  messagingChartData,
  internalDayData,
  channelPieData,
  categoryPieData,
  typeBarData,
}: any) {
  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Messages Sent"
          value={overview?.messaging?.total_sent || 0}
          sub={`${overview?.messaging?.delivery_rate || 0}% delivered`}
          icon={MessageCircle}
          color="blue"
        />
        <StatCard
          label="Conversations"
          value={overview?.conversations?.total || 0}
          sub={`$${overview?.conversations?.total_cost || 0} total cost`}
          icon={Users}
          color="purple"
        />
        <StatCard
          label="Active Threads"
          value={internal?.active_threads || 0}
          sub={`${internal?.total_threads || 0} total`}
          icon={Activity}
          color="green"
        />
        <StatCard
          label="Avg Response Time"
          value={formatDuration(internal?.avg_response_time_seconds || 0)}
          sub={`${internal?.new_contacts || 0} new contacts`}
          icon={Clock}
          color="amber"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Message Volume (Internal)" subtitle="Inbound vs Outbound">
          {internalDayData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={internalDayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="day" tick={{ fill: "#71717a", fontSize: 11 }} />
                <YAxis tick={{ fill: "#71717a", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, color: "#fff" }} />
                <Area type="monotone" dataKey="inbound" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} name="Inbound" />
                <Area type="monotone" dataKey="outbound" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} name="Outbound" />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>

        <ChartCard title="Channel Distribution" subtitle="Messages by channel">
          {channelPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={channelPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                  {channelPieData.map((_: any, i: number) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, color: "#fff" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Conversation Categories" subtitle="From Meta Analytics">
          {categoryPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={categoryPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                  {categoryPieData.map((entry: any, i: number) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, color: "#fff" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart message="No Meta conversation data" />}
        </ChartCard>

        <ChartCard title="Message Types" subtitle="Distribution by type">
          {typeBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={typeBarData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis type="number" tick={{ fill: "#71717a", fontSize: 11 }} />
                <YAxis type="category" dataKey="type" tick={{ fill: "#71717a", fontSize: 11 }} width={80} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, color: "#fff" }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>
      </div>

      {/* Agent performance */}
      {(internal?.agent_performance || []).length > 0 && (
        <ChartCard title="Agent Performance" subtitle="Messages sent by agent">
          <div className="space-y-2 mt-2">
            {internal.agent_performance.map((agent: any, i: number) => {
              const maxCount = internal.agent_performance[0]?.messages_sent || 1;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400 w-40 truncate">{agent.agent}</span>
                  <div className="flex-1 bg-zinc-800 rounded-full h-5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-end pr-2"
                      style={{ width: `${Math.max((agent.messages_sent / maxCount) * 100, 10)}%` }}
                    >
                      <span className="text-[10px] text-white font-medium">{agent.messages_sent}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>
      )}
    </div>
  );
}


function MessagingTab({ overview, internal, messagingChartData, internalDayData }: any) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Sent" value={overview?.messaging?.total_sent || 0} icon={MessageCircle} color="blue" />
        <StatCard label="Total Delivered" value={overview?.messaging?.total_delivered || 0} icon={TrendingUp} color="green" />
        <StatCard label="Delivery Rate" value={`${overview?.messaging?.delivery_rate || 0}%`} icon={Activity} color="purple" />
        <StatCard label="New Contacts" value={internal?.new_contacts || 0} icon={Users} color="amber" />
      </div>

      <ChartCard title="Meta Messaging Analytics" subtitle="Messages sent vs delivered (from Meta API)">
        {messagingChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={messagingChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 11 }} />
              <YAxis tick={{ fill: "#71717a", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, color: "#fff" }} />
              <Area type="monotone" dataKey="sent" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} name="Sent" />
              <Area type="monotone" dataKey="delivered" stroke="#10b981" fill="#10b981" fillOpacity={0.2} name="Delivered" />
              <Legend />
            </AreaChart>
          </ResponsiveContainer>
        ) : <EmptyChart message="No Meta messaging data available" />}
      </ChartCard>

      <ChartCard title="Internal Message Volume" subtitle="Inbound vs Outbound from Excom DB">
        {internalDayData.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={internalDayData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="day" tick={{ fill: "#71717a", fontSize: 11 }} />
              <YAxis tick={{ fill: "#71717a", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, color: "#fff" }} />
              <Bar dataKey="inbound" fill="#3b82f6" name="Inbound" radius={[4, 4, 0, 0]} />
              <Bar dataKey="outbound" fill="#8b5cf6" name="Outbound" radius={[4, 4, 0, 0]} />
              <Legend />
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyChart />}
      </ChartCard>
    </div>
  );
}


function ConversationsTab({ overview, internal, categoryPieData }: any) {
  const convPoints = overview?.conversations?.data_points || [];

  const dailyConvData = useMemo(() => {
    const dayMap: Record<string, Record<string, string | number>> = {};
    for (const dp of convPoints) {
      const day = formatDate(dp.start);
      if (!dayMap[day]) dayMap[day] = { day };
      const cat = dp.conversation_category || "OTHER";
      dayMap[day][cat] = (dayMap[day][cat] || 0) + (dp.conversation || 0);
    }
    return Object.values(dayMap);
  }, [convPoints]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const dp of convPoints) {
      if (dp.conversation_category) cats.add(dp.conversation_category);
    }
    return Array.from(cats);
  }, [convPoints]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Conversations" value={overview?.conversations?.total || 0} icon={Users} color="purple" />
        <StatCard label="Total Cost" value={`$${overview?.conversations?.total_cost || 0}`} icon={DollarSign} color="amber" />
        <StatCard label="Active Threads" value={internal?.active_threads || 0} icon={Activity} color="green" />
        <StatCard label="Avg Response" value={formatDuration(internal?.avg_response_time_seconds || 0)} icon={Clock} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Conversations by Category" subtitle="From Meta Analytics">
          {categoryPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={categoryPieData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {categoryPieData.map((entry: any, i: number) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, color: "#fff" }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart message="No conversation category data" />}
        </ChartCard>

        <ChartCard title="Daily Conversations" subtitle="By category over time">
          {dailyConvData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyConvData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="day" tick={{ fill: "#71717a", fontSize: 11 }} />
                <YAxis tick={{ fill: "#71717a", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, color: "#fff" }} />
                {categories.map((cat, i) => (
                  <Bar key={cat} dataKey={cat} stackId="stack" fill={CATEGORY_COLORS[cat] || CHART_COLORS[i % CHART_COLORS.length]} name={cat.charAt(0) + cat.slice(1).toLowerCase()} />
                ))}
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart message="No daily conversation data" />}
        </ChartCard>
      </div>

      {/* Category breakdown table */}
      {Object.keys(overview?.conversations?.by_category || {}).length > 0 && (
        <ChartCard title="Category Breakdown" subtitle="Conversation counts by type">
          <div className="mt-3 space-y-2">
            {Object.entries(overview.conversations.by_category).map(([cat, count]: [string, any]) => (
              <div key={cat} className="flex items-center justify-between py-2 px-3 rounded-lg bg-zinc-800/50">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat] || "#6b7280" }} />
                  <span className="text-sm text-zinc-300">{cat.charAt(0) + cat.slice(1).toLowerCase()}</span>
                </div>
                <span className="text-sm font-medium text-white">{formatNumber(count)}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      )}
    </div>
  );
}


function PricingTab({ overview }: any) {
  const pricingPoints = overview?.pricing?.data_points || [];

  const pricingByCategory = useMemo(() => {
    const catMap: Record<string, { volume: number; cost: number }> = {};
    for (const dp of pricingPoints) {
      const cat = dp.pricing_category || "OTHER";
      if (!catMap[cat]) catMap[cat] = { volume: 0, cost: 0 };
      catMap[cat].volume += dp.volume || 0;
      catMap[cat].cost += dp.cost || 0;
    }
    return Object.entries(catMap).map(([name, data]) => ({
      name: name.charAt(0) + name.slice(1).toLowerCase().replace(/_/g, " "),
      ...data,
    }));
  }, [pricingPoints]);

  const dailyPricing = useMemo(() => {
    const dayMap: Record<string, { day: string; cost: number; volume: number }> = {};
    for (const dp of pricingPoints) {
      const day = formatDate(dp.start);
      if (!dayMap[day]) dayMap[day] = { day, cost: 0, volume: 0 };
      dayMap[day].cost += dp.cost || 0;
      dayMap[day].volume += dp.volume || 0;
    }
    return Object.values(dayMap);
  }, [pricingPoints]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Total Cost" value={`$${overview?.pricing?.total_cost || 0}`} icon={DollarSign} color="rose" />
        <StatCard label="Total Volume" value={overview?.pricing?.total_volume || 0} icon={MessageCircle} color="blue" />
        <StatCard
          label="Cost per Message"
          value={
            overview?.pricing?.total_volume
              ? `$${(overview.pricing.total_cost / overview.pricing.total_volume).toFixed(4)}`
              : "$0"
          }
          icon={TrendingUp}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Daily Spending" subtitle="Cost over time">
          {dailyPricing.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dailyPricing}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="day" tick={{ fill: "#71717a", fontSize: 11 }} />
                <YAxis tick={{ fill: "#71717a", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, color: "#fff" }} formatter={(v) => [`$${Number(v).toFixed(2)}`, "Cost"]} />
                <Area type="monotone" dataKey="cost" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyChart message="No pricing data available" />}
        </ChartCard>

        <ChartCard title="Cost by Category" subtitle="Spending breakdown">
          {pricingByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={pricingByCategory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="name" tick={{ fill: "#71717a", fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fill: "#71717a", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, color: "#fff" }} />
                <Bar dataKey="cost" fill="#f59e0b" name="Cost ($)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart message="No category pricing data" />}
        </ChartCard>
      </div>

      {pricingByCategory.length > 0 && (
        <ChartCard title="Pricing Breakdown" subtitle="Volume and cost by category">
          <div className="mt-3">
            <div className="grid grid-cols-3 gap-2 text-xs text-zinc-500 font-medium px-3 py-1.5">
              <span>Category</span>
              <span className="text-right">Volume</span>
              <span className="text-right">Cost</span>
            </div>
            {pricingByCategory.map((row) => (
              <div key={row.name} className="grid grid-cols-3 gap-2 px-3 py-2 rounded-lg hover:bg-zinc-800/50">
                <span className="text-sm text-zinc-300">{row.name}</span>
                <span className="text-sm text-white text-right">{formatNumber(row.volume)}</span>
                <span className="text-sm text-white text-right">${row.cost.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      )}
    </div>
  );
}


function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      {subtitle && <p className="text-xs text-zinc-500 mt-0.5 mb-3">{subtitle}</p>}
      {children}
    </div>
  );
}


function EmptyChart({ message = "No data available for this period" }: { message?: string }) {
  return (
    <div className="flex items-center justify-center h-60 text-zinc-600">
      <div className="text-center">
        <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-xs">{message}</p>
      </div>
    </div>
  );
}
