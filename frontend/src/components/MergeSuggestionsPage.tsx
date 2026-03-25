import { useState, useEffect, useCallback } from "react";
import { useFrappePostCall } from "frappe-react-sdk";
import {
  ArrowLeft,
  GitMerge,
  X,
  Phone,
  Mail,
  MessageCircle,
  Check,
} from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";

interface Suggestion {
  source_name: string;
  source_display_name: string;
  source_phone: string;
  source_email: string;
  source_whatsapp: string;
  target_name: string;
  target_display_name: string;
  target_phone: string;
  target_email: string;
  target_whatsapp: string;
  shared_fields: string[];
}

export function MergeSuggestionsPage({
  onNavigateBack,
}: {
  onNavigateBack: () => void;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [processing, setProcessing] = useState<Set<string>>(new Set());

  const { call: fetchSuggestions } = useFrappePostCall(
    "excom.excom.api.merge_suggestions.get_merge_suggestions"
  );
  const { call: approveMerge } = useFrappePostCall(
    "excom.excom.api.merge_suggestions.approve_merge"
  );
  const { call: dismissSuggestion } = useFrappePostCall(
    "excom.excom.api.merge_suggestions.dismiss_suggestion"
  );

  const loadSuggestions = useCallback(async () => {
    try {
      const res = await fetchSuggestions({ limit: 100 });
      setSuggestions((res as any)?.message || []);
    } catch {
      toast.error("Failed to load suggestions");
    }
  }, [fetchSuggestions]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  const handleMerge = async (source: string, target: string) => {
    setProcessing((prev) => new Set(prev).add(source));
    try {
      await approveMerge({ source, target });
      toast.success("Identities merged");
      setSuggestions((prev) => prev.filter((s) => s.source_name !== source));
    } catch {
      toast.error("Merge failed");
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(source);
        return next;
      });
    }
  };

  const handleDismiss = async (source: string) => {
    setProcessing((prev) => new Set(prev).add(source));
    try {
      await dismissSuggestion({ identity: source });
      toast.success("Suggestion dismissed");
      setSuggestions((prev) => prev.filter((s) => s.source_name !== source));
    } catch {
      toast.error("Dismiss failed");
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(source);
        return next;
      });
    }
  };

  return (
    <div className="h-full w-full bg-zinc-950 flex flex-col">
      <div className="shrink-0 px-6 py-4 border-b border-zinc-800 flex items-center gap-3">
        <button
          onClick={onNavigateBack}
          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <GitMerge className="w-5 h-5 text-green-400" />
        <h1 className="text-lg font-semibold text-white">Merge Suggestions</h1>
        <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full ml-2">
          {suggestions.length} pending
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {suggestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <GitMerge className="w-12 h-12 text-zinc-600 mb-3" />
            <p className="text-zinc-400 text-sm">No merge suggestions</p>
            <p className="text-zinc-500 text-xs mt-1">
              The system scans daily for potential duplicate identities
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl mx-auto">
            {suggestions.map((s) => (
              <div
                key={s.source_name}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-5"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {s.shared_fields.map((f) => (
                      <span
                        key={f}
                        className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20"
                      >
                        {f === "Phone" && <Phone className="w-3 h-3 inline mr-0.5" />}
                        {f === "Email" && <Mail className="w-3 h-3 inline mr-0.5" />}
                        {f === "WhatsApp" && <MessageCircle className="w-3 h-3 inline mr-0.5" />}
                        Shared {f}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-zinc-700 text-zinc-400 hover:text-white"
                      disabled={processing.has(s.source_name)}
                      onClick={() => handleDismiss(s.source_name)}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Dismiss
                    </Button>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      disabled={processing.has(s.source_name)}
                      onClick={() => handleMerge(s.source_name, s.target_name)}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Merge
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <IdentityCard
                    label="Identity A"
                    name={s.target_name}
                    displayName={s.target_display_name}
                    phone={s.target_phone}
                    email={s.target_email}
                    whatsapp={s.target_whatsapp}
                  />
                  <IdentityCard
                    label="Identity B"
                    name={s.source_name}
                    displayName={s.source_display_name}
                    phone={s.source_phone}
                    email={s.source_email}
                    whatsapp={s.source_whatsapp}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function IdentityCard({
  label,
  name,
  displayName,
  phone,
  email,
  whatsapp,
}: {
  label: string;
  name: string;
  displayName: string;
  phone: string;
  email: string;
  whatsapp: string;
}) {
  return (
    <div className="bg-zinc-800/50 rounded-lg p-4">
      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</span>
      <p className="text-sm font-medium text-white mt-1">{displayName || name}</p>
      <div className="mt-2 space-y-1">
        {phone && (
          <p className="text-xs text-zinc-400 flex items-center gap-1.5">
            <Phone className="w-3 h-3" /> {phone}
          </p>
        )}
        {email && (
          <p className="text-xs text-zinc-400 flex items-center gap-1.5">
            <Mail className="w-3 h-3" /> {email}
          </p>
        )}
        {whatsapp && (
          <p className="text-xs text-zinc-400 flex items-center gap-1.5">
            <MessageCircle className="w-3 h-3" /> {whatsapp}
          </p>
        )}
      </div>
    </div>
  );
}
