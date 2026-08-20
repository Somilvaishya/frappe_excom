import { X, Sparkles, Copy, Send, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { useAISuggestions } from "../../hooks/useAISuggestions";

interface MobileAIDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onUseSuggestion: (suggestion: string) => void;
  threadId?: string;
}

export function MobileAIDrawer({
  isOpen,
  onClose,
  onUseSuggestion,
  threadId,
}: MobileAIDrawerProps) {
  const { suggestions, isLoading, refresh } = useAISuggestions(
    isOpen ? threadId || null : null,
  );

  if (!isOpen) return null;

  const { suggested_replies, summary, next_actions, insights } = suggestions;

  return (
    <div className="fixed inset-0 z-50 bg-white/95 backdrop-blur-sm flex flex-col overflow-hidden">
      <div className="shrink-0 bg-gradient-to-r from-blue-600 to-purple-600 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-zinc-900" />
          </div>
          <div>
            <h3 className="font-semibold text-zinc-900">AI Assistant</h3>
            <p className="text-xs text-zinc-900/80">
              Smart suggestions & insights
            </p>
          </div>
        </div>
        <Button
          onClick={onClose}
          variant="ghost"
          size="icon"
          className="text-zinc-900 hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-blue-700 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Conversation Summary */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-zinc-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-700" />
                Conversation Summary
              </h4>
              <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-200">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-zinc-600">Sentiment:</span>
                  <Badge className="bg-green-500/10 text-green-700 border-green-500/20 border text-xs">
                    {summary.sentiment}
                  </Badge>
                </div>
                <p className="text-sm text-zinc-700 leading-relaxed">
                  {summary.text || "No summary available"}
                </p>
              </div>
            </div>

            {/* Next Actions */}
            {next_actions.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-zinc-900">
                  Suggested Next Actions
                </h4>
                <div className="space-y-2">
                  {next_actions.map((action, index) => (
                    <div
                      key={index}
                      className="bg-zinc-50 rounded-lg p-3 border border-zinc-200 flex items-start gap-3"
                    >
                      <div className="w-6 h-6 bg-blue-500/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs text-blue-700">{index + 1}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-zinc-700">{action.action}</p>
                        <Badge className="mt-1 text-[10px] bg-zinc-100 text-zinc-600 border-zinc-300 border">
                          {action.priority}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggested Replies */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-zinc-900">
                Smart Reply Suggestions
              </h4>
              {suggested_replies.length > 0 ? (
                <div className="space-y-3">
                  {suggested_replies.map((suggestion, index) => (
                    <div
                      key={index}
                      className="bg-zinc-50 rounded-xl p-3 border border-zinc-200"
                    >
                      <p className="text-sm text-zinc-700 mb-3 leading-relaxed">
                        {suggestion.text}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          onClick={() =>
                            navigator.clipboard.writeText(suggestion.text)
                          }
                          variant="outline"
                          size="sm"
                          className="flex-1 border-zinc-300 hover:bg-zinc-100 text-xs h-8"
                        >
                          <Copy className="w-3 h-3 mr-1.5" />
                          Copy
                        </Button>
                        <Button
                          onClick={() => onUseSuggestion(suggestion.text)}
                          size="sm"
                          className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-xs h-8 text-white"
                        >
                          <Send className="w-3 h-3 mr-1.5" />
                          Use
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-600">No reply suggestions yet</p>
              )}
            </div>

            {/* AI Insights */}
            <div className="space-y-3 pb-4">
              <h4 className="text-sm font-medium text-zinc-900">AI Insights</h4>
              <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-xl p-3 border border-blue-500/20 space-y-2">
                <p className="text-sm text-zinc-700">
                  {insights.response_pattern}
                </p>
                <p className="text-sm text-zinc-700">
                  Best contact time: {insights.best_contact_time}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
