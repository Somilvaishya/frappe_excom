import { useState, useEffect, useCallback, useRef } from "react";
import { useFrappePostCall } from "frappe-react-sdk";
import {
  ArrowLeft,
  Plus,
  Search,
  Users,
  Mail,
  Phone,
  UserMinus,
  UserPlus,
  Trash2,
  Upload,
  Radio,
  ChevronDown,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "sonner";

interface SubscriberList {
  name: string;
  list_name: string;
  description: string;
  total_subscribers: number;
  active_subscribers: number;
  creation: string;
}

interface Subscriber {
  name: string;
  omni_identity: string;
  status: string;
  subscribed_on: string;
  unsubscribed_on: string;
  display_name: string;
  primary_email: string;
  primary_phone: string;
  primary_whatsapp: string;
}

function StatBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "zinc" | "green" | "red";
}) {
  const colorMap = {
    zinc: "text-zinc-300",
    green: "text-green-400",
    red: "text-red-400",
  };
  return (
    <div className="flex items-center gap-2">
      <span className={`text-lg font-semibold ${colorMap[color]}`}>
        {value}
      </span>
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
  );
}

function CreateListDialog({
  onCreate,
  onClose,
}: {
  onCreate: (name: string, desc: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-white mb-4">
          Create Subscriber List
        </h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">List Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. VIP Customers"
              className="bg-zinc-800 border-zinc-700 text-white"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Description</label>
            <Input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Optional description"
              className="bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose} className="border-zinc-700 text-zinc-300">
            Cancel
          </Button>
          <Button
            onClick={() => name.trim() && onCreate(name.trim(), desc.trim())}
            disabled={!name.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Create
          </Button>
        </div>
      </div>
    </div>
  );
}

interface IdentityOption {
  name: string;
  display_name: string;
  primary_email: string;
  primary_phone: string;
  primary_whatsapp: string;
}

function AddSubscriberDialog({
  listName,
  onAddByIdentity,
  onAddByContact,
  onClose,
}: {
  listName: string;
  onAddByIdentity: (identityName: string) => void;
  onAddByContact: (phone: string, email: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"search" | "manual">("search");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<IdentityOption[]>([]);
  const [selected, setSelected] = useState<IdentityOption | null>(null);
  const { call: searchIdentities } = useFrappePostCall("excom.excom.api.subscribers.search_identities");

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (tab !== "search") return;
      try {
        const res = await searchIdentities({ search, limit: 15 });
        setResults((res as any)?.message || []);
      } catch {
        setResults([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [search, tab, searchIdentities]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-white mb-1">Add Subscriber</h2>
        <p className="text-xs text-zinc-400 mb-4">
          Add to <span className="text-zinc-300">{listName}</span>
        </p>

        <div className="flex gap-1 mb-4 bg-zinc-800 rounded-lg p-1">
          <button
            onClick={() => setTab("search")}
            className={`flex-1 px-3 py-1.5 text-xs rounded-md transition-colors ${
              tab === "search" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-white"
            }`}
          >
            Search Identity
          </button>
          <button
            onClick={() => setTab("manual")}
            className={`flex-1 px-3 py-1.5 text-xs rounded-md transition-colors ${
              tab === "manual" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-white"
            }`}
          >
            By Phone / Email
          </button>
        </div>

        {tab === "search" ? (
          <div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
                placeholder="Search by name, email, phone..."
                className="pl-9 bg-zinc-800 border-zinc-700 text-white"
                autoFocus
              />
            </div>
            <div className="max-h-52 overflow-y-auto space-y-1 mb-4">
              {results.length === 0 ? (
                <div className="text-xs text-zinc-500 text-center py-6">
                  {search ? "No identities found" : "Type to search contacts..."}
                </div>
              ) : (
                results.map((r) => (
                  <button
                    key={r.name}
                    onClick={() => setSelected(r)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                      selected?.name === r.name
                        ? "bg-blue-600/20 border border-blue-500/40"
                        : "hover:bg-zinc-800 border border-transparent"
                    }`}
                  >
                    <div className="text-sm text-white font-medium">
                      {r.display_name || r.name}
                    </div>
                    <div className="flex gap-3 mt-0.5">
                      {r.primary_email && (
                        <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {r.primary_email}
                        </span>
                      )}
                      {r.primary_phone && (
                        <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {r.primary_phone}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose} className="border-zinc-700 text-zinc-300">
                Cancel
              </Button>
              <Button
                onClick={() => selected && onAddByIdentity(selected.name)}
                disabled={!selected}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Add
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="space-y-3 mb-6">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Phone</label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Email</label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose} className="border-zinc-700 text-zinc-300">
                Cancel
              </Button>
              <Button
                onClick={() => (phone.trim() || email.trim()) && onAddByContact(phone.trim(), email.trim())}
                disabled={!phone.trim() && !email.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Add
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ImportDialog({
  listName,
  onImport,
  onClose,
}: {
  listName: string;
  onImport: (doctype: string, filters: object, limit: number) => void;
  onClose: () => void;
}) {
  const [doctype, setDoctype] = useState("Customer");
  const [limit, setLimit] = useState(0);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-white mb-1">Import Subscribers</h2>
        <p className="text-xs text-zinc-400 mb-4">
          Bulk-add from ERPNext into <span className="text-zinc-300">{listName}</span>.
          Omni Identities will be auto-created.
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Source DocType</label>
            <select
              value={doctype}
              onChange={(e) => setDoctype(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
            >
              <option value="Customer">Customer</option>
              <option value="Supplier">Supplier</option>
              <option value="Lead">Lead</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Limit (0 = all)</label>
            <Input
              type="number"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value) || 0)}
              className="bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose} className="border-zinc-700 text-zinc-300">
            Cancel
          </Button>
          <Button
            onClick={() => onImport(doctype, {}, limit)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Upload className="w-4 h-4 mr-1.5" />
            Import
          </Button>
        </div>
      </div>
    </div>
  );
}

function SubscriberDetailView({
  list,
  subscribers,
  stats,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onBack,
  onRefresh,
  onBroadcast,
}: {
  list: SubscriberList;
  subscribers: Subscriber[];
  stats: { total: number; active: number; unsubscribed: number };
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: string;
  onStatusFilterChange: (s: string) => void;
  onBack: () => void;
  onRefresh: () => void;
  onBroadcast?: (listName: string) => void;
}) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const { call: addByIdentity } = useFrappePostCall(
    "excom.excom.api.subscribers.add_subscriber"
  );
  const { call: addByContact } = useFrappePostCall(
    "excom.excom.api.subscribers.add_subscriber_by_contact"
  );
  const { call: removeSubscriber } = useFrappePostCall(
    "excom.excom.api.subscribers.remove_subscriber"
  );
  const { call: unsubscribeCall } = useFrappePostCall(
    "excom.excom.api.subscribers.unsubscribe_subscriber"
  );
  const { call: resubscribeCall } = useFrappePostCall(
    "excom.excom.api.subscribers.resubscribe"
  );
  const { call: importFromDoctype } = useFrappePostCall(
    "excom.excom.api.subscribers.import_from_doctype"
  );

  return (
    <div className="h-full w-full bg-zinc-950 flex flex-col">
      <div className="shrink-0 px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-white">{list.list_name}</h1>
              {list.description && (
                <p className="text-xs text-zinc-400">{list.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowImportDialog(true)}
              variant="outline"
              className="text-sm border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              <Upload className="w-4 h-4 mr-1.5" />
              Import
            </Button>
            <Button
              onClick={() => setShowAddDialog(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add
            </Button>
            <Button
              onClick={() => {
                if (onBroadcast) onBroadcast(list.name);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
            >
              <Radio className="w-4 h-4 mr-1.5" />
              Broadcast
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-6 mt-4">
          <StatBadge label="Total" value={stats.total} color="zinc" />
          <StatBadge label="Active" value={stats.active} color="green" />
          <StatBadge label="Unsubscribed" value={stats.unsubscribed} color="red" />
        </div>
      </div>

      <div className="px-6 py-3 border-b border-zinc-800 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name, email, or phone..."
            className="pl-9 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-zinc-500"
        >
          <option value="">All Status</option>
          <option value="Subscribed">Subscribed</option>
          <option value="Unsubscribed">Unsubscribed</option>
        </select>
      </div>

      <div className="flex-1 overflow-y-auto">
        {subscribers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <UserPlus className="w-12 h-12 text-zinc-600 mb-3" />
            <p className="text-zinc-400 text-sm">No subscribers yet</p>
            <p className="text-zinc-500 text-xs mt-1">
              Add subscribers manually or import from ERPNext
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
                <th className="text-left px-6 py-3">Name</th>
                <th className="text-left px-6 py-3">Email</th>
                <th className="text-left px-6 py-3">Phone</th>
                <th className="text-left px-6 py-3">Status</th>
                <th className="text-left px-6 py-3">Subscribed</th>
                <th className="text-right px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((sub) => (
                <tr
                  key={sub.name}
                  className="border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-colors"
                >
                  <td className="px-6 py-3">
                    <span className="text-sm text-white">
                      {sub.display_name || "Unknown"}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-sm text-zinc-400 flex items-center gap-1.5">
                      {sub.primary_email && (
                        <>
                          <Mail className="w-3.5 h-3.5" />
                          {sub.primary_email}
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-sm text-zinc-400 flex items-center gap-1.5">
                      {sub.primary_phone && (
                        <>
                          <Phone className="w-3.5 h-3.5" />
                          {sub.primary_phone}
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        sub.status === "Subscribed"
                          ? "bg-green-500/10 text-green-400"
                          : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {sub.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-xs text-zinc-500">
                    {sub.subscribed_on
                      ? new Date(sub.subscribed_on).toLocaleDateString()
                      : "\u2014"}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {sub.status === "Subscribed" ? (
                        <button
                          onClick={async () => {
                            await unsubscribeCall({ subscriber_name: sub.name });
                            toast.success("Unsubscribed");
                            onRefresh();
                          }}
                          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-orange-400"
                          title="Unsubscribe"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            await resubscribeCall({ subscriber_name: sub.name });
                            toast.success("Re-subscribed");
                            onRefresh();
                          }}
                          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-green-400"
                          title="Re-subscribe"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          await removeSubscriber({ subscriber_name: sub.name });
                          toast.success("Removed");
                          onRefresh();
                        }}
                        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-red-400"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAddDialog && (
        <AddSubscriberDialog
          listName={list.list_name}
          onAddByIdentity={async (identityName) => {
            try {
              const res = await addByIdentity({ subscriber_list: list.name, omni_identity: identityName });
              const data = (res as any)?.message || {};
              if (data.success === false) {
                toast.info(data.message || "Already subscribed");
              } else {
                toast.success("Subscriber added");
              }
              setShowAddDialog(false);
              onRefresh();
            } catch {
              toast.error("Failed to add subscriber");
            }
          }}
          onAddByContact={async (phone, email) => {
            try {
              await addByContact({ subscriber_list: list.name, phone, email });
              toast.success("Subscriber added");
              setShowAddDialog(false);
              onRefresh();
            } catch {
              toast.error("Failed to add subscriber");
            }
          }}
          onClose={() => setShowAddDialog(false)}
        />
      )}

      {showImportDialog && (
        <ImportDialog
          listName={list.name}
          onImport={async (doctype, filters, limit) => {
            try {
              const res = await importFromDoctype({
                subscriber_list: list.name,
                doctype,
                filters: JSON.stringify(filters),
                limit,
              });
              const data = (res as any)?.message || {};
              toast.success(`Imported: ${data.added} added, ${data.skipped} skipped`);
              setShowImportDialog(false);
              onRefresh();
            } catch {
              toast.error("Import failed");
            }
          }}
          onClose={() => setShowImportDialog(false)}
        />
      )}
    </div>
  );
}

export function SubscriberListPage({
  onNavigateBack,
  onNavigateToBroadcasts,
}: {
  onNavigateBack: () => void;
  onNavigateToBroadcasts?: () => void;
}) {
  const [viewMode, setViewMode] = useState<"lists" | "detail">("lists");
  const [selectedList, setSelectedList] = useState<SubscriberList | null>(null);
  const [lists, setLists] = useState<SubscriberList[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [subscriberStats, setSubscriberStats] = useState({
    total: 0,
    active: 0,
    unsubscribed: 0,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { call: fetchLists } = useFrappePostCall(
    "excom.excom.api.subscribers.get_subscriber_lists"
  );
  const { call: fetchSubscribers } = useFrappePostCall(
    "excom.excom.api.subscribers.get_subscribers"
  );
  const { call: createList } = useFrappePostCall(
    "excom.excom.api.subscribers.create_subscriber_list"
  );

  const loadLists = useCallback(async () => {
    try {
      const res = await fetchLists({ search: searchQuery });
      setLists((res as any)?.message || []);
    } catch {
      toast.error("Failed to load subscriber lists");
    }
  }, [fetchLists, searchQuery]);

  const loadSubscribers = useCallback(async () => {
    if (!selectedList) return;
    try {
      const res = await fetchSubscribers({
        subscriber_list: selectedList.name,
        search: searchQuery,
        status: statusFilter,
      });
      const data = (res as any)?.message || {};
      setSubscribers(data.subscribers || []);
      setSubscriberStats({
        total: data.total || 0,
        active: data.active || 0,
        unsubscribed: data.unsubscribed || 0,
      });
    } catch {
      toast.error("Failed to load subscribers");
    }
  }, [fetchSubscribers, selectedList, searchQuery, statusFilter]);

  useEffect(() => {
    if (viewMode === "lists") loadLists();
  }, [viewMode, loadLists]);

  useEffect(() => {
    if (viewMode === "detail") loadSubscribers();
  }, [viewMode, loadSubscribers]);

  const handleSelectList = (list: SubscriberList) => {
    setSelectedList(list);
    setSearchQuery("");
    setStatusFilter("");
    setViewMode("detail");
  };

  const handleBackToLists = () => {
    setViewMode("lists");
    setSelectedList(null);
    setSearchQuery("");
  };

  if (viewMode === "detail" && selectedList) {
    return (
      <SubscriberDetailView
        list={selectedList}
        subscribers={subscribers}
        stats={subscriberStats}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onBack={handleBackToLists}
        onRefresh={loadSubscribers}
        onBroadcast={onNavigateToBroadcasts ? () => onNavigateToBroadcasts() : undefined}
      />
    );
  }

  return (
    <div className="h-full w-full bg-zinc-950 flex flex-col">
      <div className="shrink-0 px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateBack}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Users className="w-5 h-5 text-blue-400" />
          <h1 className="text-lg font-semibold text-white">Subscriber Lists</h1>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          New List
        </Button>
      </div>

      <div className="px-6 py-3 border-b border-zinc-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search lists..."
            className="pl-9 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {lists.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Users className="w-12 h-12 text-zinc-600 mb-3" />
            <p className="text-zinc-400 text-sm">No subscriber lists yet</p>
            <p className="text-zinc-500 text-xs mt-1">
              Create a list to start grouping your contacts
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lists.map((list) => (
              <button
                key={list.name}
                onClick={() => handleSelectList(list)}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-left hover:border-zinc-600 transition-colors group"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-medium text-white group-hover:text-blue-400 transition-colors">
                    {list.list_name}
                  </h3>
                  <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full">
                    {list.active_subscribers} active
                  </span>
                </div>
                {list.description && (
                  <p className="text-xs text-zinc-400 mb-3 line-clamp-2">
                    {list.description}
                  </p>
                )}
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <span>{list.total_subscribers} total</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showCreateDialog && (
        <CreateListDialog
          onCreate={async (name, desc) => {
            try {
              await createList({ list_name: name, description: desc });
              toast.success("List created");
              setShowCreateDialog(false);
              loadLists();
            } catch {
              toast.error("Failed to create list");
            }
          }}
          onClose={() => setShowCreateDialog(false)}
        />
      )}
    </div>
  );
}
