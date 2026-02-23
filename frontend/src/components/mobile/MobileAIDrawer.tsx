import { X, Sparkles, Copy, Send } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

interface MobileAIDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onUseSuggestion: (suggestion: string) => void;
}

const SUGGESTIONS = [
  {
    id: "1",
    title: "Friendly Follow-up",
    content:
      "Thanks for your interest! I'd love to schedule a demo to show you how our solution can help your business. What times work best for you this week?",
  },
  {
    id: "2",
    title: "Quick Response",
    content:
      "I'll get that information to you right away. Give me just a moment to pull up the details.",
  },
  {
    id: "3",
    title: "Professional Closing",
    content:
      "Let me know if you have any other questions. I'm here to help and looking forward to working with you!",
  },
];

const SUMMARY = {
  sentiment: "positive",
  topics: ["Product Demo", "Pricing", "Timeline"],
  nextActions: [
    "Schedule product demo",
    "Send pricing details",
    "Follow up on timeline requirements",
  ],
};

export function MobileAIDrawer({
  isOpen,
  onClose,
  onUseSuggestion,
}: MobileAIDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/95 backdrop-blur-sm flex flex-col overflow-hidden">
      <div className="shrink-0 bg-gradient-to-r from-blue-600 to-purple-600 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">AI Assistant</h3>
            <p className="text-xs text-white/80">
              Smart suggestions & insights
            </p>
          </div>
        </div>
        <Button
          onClick={onClose}
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="space-y-6">
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              Conversation Summary
            </h4>
            <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-zinc-500">Sentiment:</span>
                <Badge className="bg-green-500/10 text-green-400 border-green-500/20 border text-xs">
                  {SUMMARY.sentiment}
                </Badge>
              </div>
              <div className="mb-3">
                <p className="text-xs text-zinc-500 mb-2">
                  Topics Discussed:
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUMMARY.topics.map((topic) => (
                    <Badge
                      key={topic}
                      variant="outline"
                      className="border-zinc-700 text-zinc-300 text-xs"
                    >
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-white">
              Suggested Next Actions
            </h4>
            <div className="space-y-2">
              {SUMMARY.nextActions.map((action, index) => (
                <div
                  key={index}
                  className="bg-zinc-900 rounded-lg p-3 border border-zinc-800 flex items-start gap-3"
                >
                  <div className="w-6 h-6 bg-blue-500/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs text-blue-400">{index + 1}</span>
                  </div>
                  <p className="text-sm text-zinc-300 flex-1">{action}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-white">
              Smart Reply Suggestions
            </h4>
            <div className="space-y-3">
              {SUGGESTIONS.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="bg-zinc-900 rounded-xl p-4 border border-zinc-800"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-blue-400">
                      {suggestion.title}
                    </span>
                    <Badge
                      variant="outline"
                      className="border-zinc-700 text-zinc-400 text-[10px]"
                    >
                      AI Generated
                    </Badge>
                  </div>
                  <p className="text-sm text-zinc-300 mb-3 leading-relaxed">
                    {suggestion.content}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={() =>
                        navigator.clipboard.writeText(suggestion.content)
                      }
                      variant="outline"
                      size="sm"
                      className="flex-1 border-zinc-700 hover:bg-zinc-800 text-xs h-8"
                    >
                      <Copy className="w-3 h-3 mr-1.5" />
                      Copy
                    </Button>
                    <Button
                      onClick={() => onUseSuggestion(suggestion.content)}
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
          </div>

          <div className="space-y-3 pb-6">
            <h4 className="text-sm font-medium text-white">AI Insights</h4>
            <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-xl p-4 border border-blue-500/20">
              <p className="text-sm text-zinc-300 leading-relaxed">
                This lead shows high engagement and interest. They&apos;ve
                asked specific questions about enterprise features and
                timeline. Consider prioritizing this conversation and
                scheduling a demo within the next 24-48 hours.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
