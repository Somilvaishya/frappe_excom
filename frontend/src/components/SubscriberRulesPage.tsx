import { useState, useEffect, useCallback, useRef } from "react";
import { useFrappePostCall } from "frappe-react-sdk";
import {
  ArrowLeft,
  Cog,
  Plus,
  ToggleLeft,
  ToggleRight,
  Pencil,
  Play,
  Check,
  X,
  AlertCircle,
  Search,
  ChevronDown,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "sonner";

interface Rule {
  name: string;
  rule_name: string;
  enabled: number;
  subscriber_list: string;
  reference_doctype: string;
  event: string;
  condition: string;
  identity_field: string;
  identity_field_type: string;
  description: string;
}

interface TestResult {
  condition_match: boolean;
  entity_name: string | null;
  identity_name: string | null;
  already_subscribed: boolean;
  would_subscribe: boolean;
}

interface DropdownOption {
  value: string;
  label: string;
  sublabel?: string;
}

function SearchableSelect({
  value,
  onChange,
  fetchOptions,
  placeholder,
  displayValue,
}: {
  value: string;
  onChange: (val: string) => void;
  fetchOptions: (search: string) => Promise<DropdownOption[]>;
  placeholder: string;
  displayValue?: string;
}) {
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<DropdownOption[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const res = await fetchOptions(search);
      setOptions(res);
    }, 150);
    return () => clearTimeout(timer);
  }, [search, fetchOptions]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(""); }}
        className="w-full flex items-center justify-between bg-zinc-100 border border-zinc-300 rounded-lg px-3 py-2 text-sm text-left focus:outline-none focus:border-zinc-300"
      >
        <span className={value ? "text-zinc-900" : "text-zinc-600"}>
          {displayValue || value || placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-zinc-600 shrink-0" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 mt-1 bg-zinc-100 border border-zinc-300 rounded-lg shadow-xl z-20 max-h-56 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-zinc-300 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                autoFocus
                className="w-full bg-zinc-50 border border-zinc-300 rounded px-3 py-1.5 pl-8 text-xs text-zinc-900 focus:outline-none focus:border-zinc-300"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {options.length === 0 ? (
              <div className="px-3 py-2 text-xs text-zinc-600 text-center">
                {search ? "No results" : "Type to search..."}
              </div>
            ) : (
              options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-200/50 transition-colors ${
                    opt.value === value ? "bg-zinc-200/30 text-blue-700" : "text-zinc-900"
                  }`}
                >
                  {opt.label}
                  {opt.sublabel && (
                    <span className="text-[10px] text-zinc-600 ml-2">{opt.sublabel}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RuleFormDialog({
  existing,
  onSave,
  onClose,
}: {
  existing?: Rule;
  onSave: (data: Partial<Rule>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    rule_name: existing?.rule_name || "",
    subscriber_list: existing?.subscriber_list || "",
    reference_doctype: existing?.reference_doctype || "",
    event: existing?.event || "After Insert",
    identity_field: existing?.identity_field || "",
    identity_field_type: existing?.identity_field_type || "Customer",
    condition: existing?.condition || "",
    description: existing?.description || "",
  });

  const [linkFields, setLinkFields] = useState<DropdownOption[]>([]);

  const { call: searchDoctypes } = useFrappePostCall("excom.excom.api.subscriber_rules.search_doctypes");
  const { call: searchLists } = useFrappePostCall("excom.excom.api.subscriber_rules.search_subscriber_lists");
  const { call: fetchFields } = useFrappePostCall("excom.excom.api.subscriber_rules.get_doctype_fields");

  useEffect(() => {
    if (!form.reference_doctype) { setLinkFields([]); return; }
    fetchFields({ doctype: form.reference_doctype }).then((res) => {
      const fields = ((res as any)?.message || []).map((f: any) => ({
        value: f.fieldname,
        label: `${f.label} (${f.fieldname})`,
        sublabel: f.options,
      }));
      setLinkFields(fields);
    }).catch(() => setLinkFields([]));
  }, [form.reference_doctype]);

  const update = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const fetchDoctypeOptions = useCallback(async (q: string): Promise<DropdownOption[]> => {
    try {
      const res = await searchDoctypes({ search: q, limit: 20 });
      return ((res as any)?.message || []).map((d: any) => ({
        value: d.name,
        label: d.name,
        sublabel: d.module,
      }));
    } catch { return []; }
  }, [searchDoctypes]);

  const fetchListOptions = useCallback(async (q: string): Promise<DropdownOption[]> => {
    try {
      const res = await searchLists({ search: q, limit: 20 });
      return ((res as any)?.message || []).map((d: any) => ({
        value: d.name,
        label: d.list_name || d.name,
      }));
    } catch { return []; }
  }, [searchLists]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-zinc-50 border border-zinc-300 rounded-xl w-full max-w-xl p-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-zinc-900 mb-3">
          {existing ? "Edit Rule" : "Create Rule"}
        </h2>
        <div className="space-y-3">
          <Field label="Rule Name">
            <Input
              value={form.rule_name}
              onChange={(e) => update("rule_name", e.target.value)}
              placeholder="e.g. Agra Store POS Customers"
              className="bg-zinc-100 border-zinc-300 text-zinc-900"
              autoFocus
            />
          </Field>
          <Field label="Subscriber List">
            <SearchableSelect
              value={form.subscriber_list}
              onChange={(v) => update("subscriber_list", v)}
              fetchOptions={fetchListOptions}
              placeholder="Select subscriber list..."
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Reference DocType">
              <SearchableSelect
                value={form.reference_doctype}
                onChange={(v) => {
                  update("reference_doctype", v);
                  update("identity_field", "");
                }}
                fetchOptions={fetchDoctypeOptions}
                placeholder="Select DocType..."
              />
            </Field>
            <Field label="Event">
              <select
                value={form.event}
                onChange={(e) => update("event", e.target.value)}
                className="w-full bg-zinc-100 border border-zinc-300 rounded-lg px-3 py-2 text-sm text-zinc-900"
              >
                <option>After Insert</option>
                <option>After Save</option>
                <option>After Submit</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Identity Field">
              {linkFields.length > 0 ? (
                <select
                  value={form.identity_field}
                  onChange={(e) => {
                    const fieldname = e.target.value;
                    update("identity_field", fieldname);
                    const match = linkFields.find((f) => f.value === fieldname);
                    if (match?.sublabel) update("identity_field_type", match.sublabel);
                  }}
                  className="w-full bg-zinc-100 border border-zinc-300 rounded-lg px-3 py-2 text-sm text-zinc-900"
                >
                  <option value="">Select field...</option>
                  {linkFields.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  value={form.identity_field}
                  onChange={(e) => update("identity_field", e.target.value)}
                  placeholder={form.reference_doctype ? "No link fields found, type manually" : "Select DocType first"}
                  className="bg-zinc-100 border-zinc-300 text-zinc-900"
                />
              )}
            </Field>
            <Field label="Identity Field Type">
              <select
                value={form.identity_field_type}
                onChange={(e) => update("identity_field_type", e.target.value)}
                className="w-full bg-zinc-100 border border-zinc-300 rounded-lg px-3 py-2 text-sm text-zinc-900"
              >
                <option>Customer</option>
                <option>Supplier</option>
                <option>Lead</option>
                <option>Contact</option>
              </select>
            </Field>
          </div>
          <Field label="Condition (Python expression)">
            <textarea
              value={form.condition}
              onChange={(e) => update("condition", e.target.value)}
              placeholder='doc.territory == "Agra" and doc.customer'
              rows={3}
              className="w-full bg-zinc-100 border border-zinc-300 rounded-lg px-3 py-2 text-sm text-zinc-900 font-mono resize-none focus:outline-none focus:border-zinc-300"
            />
          </Field>
          <Field label="Description">
            <Input
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="What does this rule do?"
              className="bg-zinc-100 border-zinc-300 text-zinc-900"
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose} className="border-zinc-300 text-zinc-700">
            Cancel
          </Button>
          <Button
            onClick={() => form.rule_name.trim() && onSave(form)}
            disabled={!form.rule_name.trim() || !form.subscriber_list.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {existing ? "Save" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-zinc-600 mb-1 block">{label}</label>
      {children}
    </div>
  );
}

function TestRuleDialog({
  rule,
  onClose,
}: {
  rule: Rule;
  onClose: () => void;
}) {
  const [docName, setDocName] = useState("");
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const { call: testRule } = useFrappePostCall("excom.excom.api.subscriber_rules.test_rule");

  const runTest = async () => {
    if (!docName.trim()) return;
    setLoading(true);
    try {
      const res = await testRule({ name: rule.name, doc_name: docName.trim() });
      setResult((res as any)?.message || null);
    } catch {
      toast.error("Test failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-zinc-50 border border-zinc-300 rounded-xl w-full max-w-md p-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-zinc-900 mb-1">Test Rule</h2>
        <p className="text-xs text-zinc-600 mb-3">
          Dry-run <span className="text-zinc-700">{rule.rule_name}</span> against a{" "}
          {rule.reference_doctype} document.
        </p>
        <div className="flex gap-2 mb-3">
          <Input
            value={docName}
            onChange={(e) => setDocName(e.target.value)}
            placeholder={`${rule.reference_doctype} name...`}
            className="bg-zinc-100 border-zinc-300 text-zinc-900 flex-1"
            autoFocus
          />
          <Button
            onClick={runTest}
            disabled={loading || !docName.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Play className="w-4 h-4 mr-1" />
            Run
          </Button>
        </div>

        {result && (
          <div className="bg-zinc-100/50 rounded-lg p-3 space-y-2">
            <ResultRow label="Condition Match" ok={result.condition_match} />
            <ResultRow
              label="Entity Resolved"
              ok={!!result.entity_name}
              detail={result.entity_name || "Not found"}
            />
            <ResultRow
              label="Identity Found"
              ok={!!result.identity_name}
              detail={result.identity_name || "No identity"}
            />
            <ResultRow
              label="Already Subscribed"
              ok={!result.already_subscribed}
              detail={result.already_subscribed ? "Yes" : "No"}
            />
            <div className="border-t border-zinc-300 pt-2 mt-2">
              <ResultRow
                label="Would Subscribe"
                ok={result.would_subscribe}
                detail={result.would_subscribe ? "Yes" : "No"}
                highlight
              />
            </div>
          </div>
        )}

        <div className="flex justify-end mt-4">
          <Button variant="outline" onClick={onClose} className="border-zinc-300 text-zinc-700">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function ResultRow({
  label,
  ok,
  detail,
  highlight,
}: {
  label: string;
  ok: boolean;
  detail?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between text-sm ${highlight ? "font-medium" : ""}`}>
      <span className="text-zinc-700">{label}</span>
      <span className="flex items-center gap-1.5">
        {detail && <span className="text-xs text-zinc-600 mr-1">{detail}</span>}
        {ok ? (
          <Check className="w-4 h-4 text-green-700" />
        ) : (
          <X className="w-4 h-4 text-red-700" />
        )}
      </span>
    </div>
  );
}

export function SubscriberRulesPage({
  onNavigateBack,
}: {
  onNavigateBack: () => void;
}) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | undefined>();
  const [testingRule, setTestingRule] = useState<Rule | null>(null);

  const [backfilling, setBackfilling] = useState<string | null>(null);

  const { call: fetchRules } = useFrappePostCall("excom.excom.api.subscriber_rules.get_rules");
  const { call: createRule } = useFrappePostCall("excom.excom.api.subscriber_rules.create_rule");
  const { call: updateRule } = useFrappePostCall("excom.excom.api.subscriber_rules.update_rule");
  const { call: toggleRule } = useFrappePostCall("excom.excom.api.subscriber_rules.toggle_rule");
  const { call: applyToExisting } = useFrappePostCall("excom.excom.api.subscriber_rules.apply_rule_to_existing");

  const loadRules = useCallback(async () => {
    try {
      const res = await fetchRules({});
      setRules((res as any)?.message || []);
    } catch {
      toast.error("Failed to load rules");
    }
  }, [fetchRules]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

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
          <Cog className="w-5 h-5 text-amber-700" />
          <h1 className="text-lg font-semibold text-zinc-900">Subscriber Rules</h1>
          <span className="text-xs bg-amber-500/10 text-amber-700 px-2 py-0.5 rounded-full">
            {rules.filter((r) => r.enabled).length} active
          </span>
        </div>
        <Button
          onClick={() => {
            setEditingRule(undefined);
            setShowForm(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          New Rule
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Cog className="w-12 h-12 text-zinc-500 mb-3" />
            <p className="text-zinc-600 text-sm">No subscriber rules yet</p>
            <p className="text-zinc-600 text-xs mt-1">
              Create rules to auto-subscribe contacts to lists based on document events
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-w-4xl mx-auto">
            {rules.map((rule) => (
              <div
                key={rule.name}
                className={`bg-zinc-50 border rounded-xl p-4 transition-colors ${
                  rule.enabled ? "border-zinc-200" : "border-zinc-200/50 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-zinc-900">{rule.rule_name}</h3>
                    {rule.description && (
                      <p className="text-xs text-zinc-600 mt-0.5">{rule.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        if (!rule.enabled) {
                          toast.error("Enable the rule first");
                          return;
                        }
                        setBackfilling(rule.name);
                        try {
                          const res = await applyToExisting({ name: rule.name });
                          const data = (res as any)?.message || {};
                          toast.success(
                            `Applied: ${data.added} added, ${data.skipped} skipped${data.errors ? `, ${data.errors} errors` : ""}`
                          );
                        } catch {
                          toast.error("Failed to apply rule");
                        } finally {
                          setBackfilling(null);
                        }
                      }}
                      disabled={backfilling === rule.name}
                      className="p-1.5 rounded hover:bg-zinc-100 text-zinc-600 hover:text-amber-700 disabled:opacity-40"
                      title="Apply to all existing records"
                    >
                      {backfilling === rule.name ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => setTestingRule(rule)}
                      className="p-1.5 rounded hover:bg-zinc-100 text-zinc-600 hover:text-blue-700"
                      title="Test Rule"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingRule(rule);
                        setShowForm(true);
                      }}
                      className="p-1.5 rounded hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={async () => {
                        await toggleRule({ name: rule.name, enabled: rule.enabled ? 0 : 1 });
                        toast.success(rule.enabled ? "Rule disabled" : "Rule enabled");
                        loadRules();
                      }}
                      className="p-1.5 rounded hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900"
                      title={rule.enabled ? "Disable" : "Enable"}
                    >
                      {rule.enabled ? (
                        <ToggleRight className="w-5 h-5 text-green-700" />
                      ) : (
                        <ToggleLeft className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  <Tag label="DocType" value={rule.reference_doctype} />
                  <Tag label="Event" value={rule.event} />
                  <Tag label="List" value={rule.subscriber_list} />
                  <Tag label="Field" value={`${rule.identity_field} (${rule.identity_field_type})`} />
                </div>

                {rule.condition && (
                  <div className="mt-3 bg-zinc-100/50 rounded-lg p-2.5">
                    <span className="text-[10px] text-zinc-600 uppercase tracking-wider block mb-1">
                      Condition
                    </span>
                    <code className="text-xs text-amber-700 font-mono">{rule.condition}</code>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <RuleFormDialog
          existing={editingRule}
          onSave={async (data) => {
            try {
              if (editingRule) {
                await updateRule({ name: editingRule.name, ...data });
                toast.success("Rule updated");
              } else {
                await createRule(data as any);
                toast.success("Rule created");
              }
              setShowForm(false);
              setEditingRule(undefined);
              loadRules();
            } catch {
              toast.error("Failed to save rule");
            }
          }}
          onClose={() => {
            setShowForm(false);
            setEditingRule(undefined);
          }}
        />
      )}

      {testingRule && (
        <TestRuleDialog
          rule={testingRule}
          onClose={() => setTestingRule(null)}
        />
      )}
    </div>
  );
}

function Tag({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-[11px] bg-zinc-100 text-zinc-700 px-2 py-1 rounded border border-zinc-300">
      <span className="text-zinc-600">{label}:</span> {value}
    </span>
  );
}
