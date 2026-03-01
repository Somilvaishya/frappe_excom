import {
  X,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { useAISuggestions } from "../hooks/useAISuggestions";

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  contactName: string;
  threadId?: string;
  onUseSuggestion?: (text: string) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500/10 text-red-400 border-red-500/20",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  low: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

const PRIORITY_ICONS: Record<string, React.FC<{ className?: string }>> = {
  high: AlertCircle,
  medium: Clock,
  low: CheckCircle2,
};

export function AIAssistantDrawer({
  isOpen,
  onClose,
  contactName,
  threadId,
  onUseSuggestion,
}: AIAssistantDrawerProps) {
  const { suggestions, isLoading, refresh } = useAISuggestions(
    isOpen ? threadId || null : null,
  );

  if (!isOpen) return null;

  const { suggested_replies, summary, next_actions, insights } = suggestions;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950 border-l border-zinc-800 shadow-2xl z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-zinc-800 bg-gradient-to-r from-blue-500/10 to-purple-500/10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h2 className="font-semibold text-white">AI Assistant</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        <p className="text-xs text-zinc-400">
          Intelligent suggestions for {contactName}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        ) : (
          <div className="p-4 space-y-6">
            {/* Suggested Replies */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-medium text-white">
                  Suggested Replies
                </h3>
              </div>
              {suggested_replies.length > 0 ? (
                <div className="space-y-2">
                  {suggested_replies.map((reply, index) => (
                    <button
                      key={index}
                      onClick={() => onUseSuggestion?.(reply.text)}
                      className="w-full text-left p-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg border border-zinc-700 hover:border-blue-500/50 transition-all group"
                    >
                      <p className="text-sm text-zinc-300 mb-2">{reply.text}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-500">Click to use</span>
                        <ArrowRight className="w-3 h-3 text-zinc-500 group-hover:text-blue-400 transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-500">No suggestions available yet</p>
              )}
            </div>

            <Separator className="bg-zinc-800" />

            {/* Conversation Summary */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-medium text-white">
                  Conversation Summary
                </h3>
              </div>
              <div className="bg-gradient-to-br from-purple-500/5 to-blue-500/5 rounded-lg p-4 border border-purple-500/20">
                <p className="text-sm text-zinc-300 leading-relaxed">
                  {summary.text || "No summary available"}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-purple-500/30 text-purple-400 text-xs"
                  >
                    {summary.sentiment}
                  </Badge>
                  {summary.updated_at && (
                    <span className="text-xs text-zinc-500">
                      Updated {new Date(summary.updated_at).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <Separator className="bg-zinc-800" />

            {/* Next Actions */}
            {next_actions.length > 0 && (
              <>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <h3 className="text-sm font-medium text-white">
                      Recommended Actions
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {next_actions.map((item, index) => {
                      const PriorityIcon =
                        PRIORITY_ICONS[item.priority] || CheckCircle2;
                      return (
                        <div
                          key={index}
                          className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700 hover:border-zinc-600 transition-all"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-zinc-700/50 rounded-lg flex items-center justify-center flex-shrink-0">
                              <PriorityIcon className="w-4 h-4 text-zinc-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white mb-2">{item.action}</p>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge
                                  className={`${
                                    PRIORITY_COLORS[item.priority] || ""
                                  } border text-xs`}
                                >
                                  {item.priority}
                                </Badge>
                                {item.due && (
                                  <span className="text-xs text-zinc-500">
                                    Due: {item.due}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="flex-shrink-0 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                              onClick={() => {
                                const match = item.action.match(/Lead\s+(.+)/);
                                if (match) {
                                  window.open(`/app/lead/${encodeURIComponent(match[1])}`, "_blank");
                                }
                              }}
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              Start
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <Separator className="bg-zinc-800" />
              </>
            )}

            {/* AI Insights */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-400" />
                <h3 className="text-sm font-medium text-white">Quick Insights</h3>
              </div>
              <div className="space-y-2">
                <div className="bg-gradient-to-r from-orange-500/5 to-yellow-500/5 rounded-lg p-3 border border-orange-500/20">
                  <p className="text-xs text-zinc-400 mb-1">Response Pattern</p>
                  <p className="text-sm text-zinc-300">{insights.response_pattern}</p>
                </div>
                <div className="bg-gradient-to-r from-green-500/5 to-emerald-500/5 rounded-lg p-3 border border-green-500/20">
                  <p className="text-xs text-zinc-400 mb-1">Engagement Level</p>
                  <p className="text-sm text-zinc-300">
                    {insights.engagement_rate > 0
                      ? `${Math.round(insights.engagement_rate * 100)}% reply ratio`
                      : "No engagement data"}
                  </p>
                </div>
                <div className="bg-gradient-to-r from-blue-500/5 to-cyan-500/5 rounded-lg p-3 border border-blue-500/20">
                  <p className="text-xs text-zinc-400 mb-1">Best Contact Time</p>
                  <p className="text-sm text-zinc-300">{insights.best_contact_time}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 p-4 border-t border-zinc-800 bg-zinc-900/50">
        <Button
          onClick={() => refresh()}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Generate More Suggestions
        </Button>
      </div>
    </div>
  );
}
