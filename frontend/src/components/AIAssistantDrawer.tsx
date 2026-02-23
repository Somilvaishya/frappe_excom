import {
  X,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  contactName: string;
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

const SUGGESTED_REPLIES = [
  "I'd be happy to schedule a demo. Are you available Tuesday or Wednesday next week?",
  "Let me check our calendar and get back to you within the hour.",
  "That sounds great! I'll send you a calendar invite shortly.",
];

const NEXT_ACTIONS = [
  { action: "Schedule demo call", priority: "high", dueDate: "Feb 24, 2026" },
  {
    action: "Send product brochure",
    priority: "medium",
    dueDate: "Feb 22, 2026",
  },
  {
    action: "Update lead status in ERP",
    priority: "low",
    dueDate: "Feb 22, 2026",
  },
];

export function AIAssistantDrawer({
  isOpen,
  onClose,
  contactName,
}: AIAssistantDrawerProps) {
  if (!isOpen) return null;

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
        <div className="p-4 space-y-6">
          {/* Suggested Replies */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-medium text-white">
                Suggested Replies
              </h3>
            </div>
            <div className="space-y-2">
              {SUGGESTED_REPLIES.map((reply, index) => (
                <button
                  key={index}
                  className="w-full text-left p-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg border border-zinc-700 hover:border-blue-500/50 transition-all group"
                >
                  <p className="text-sm text-zinc-300 mb-2">{reply}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Click to use</span>
                    <ArrowRight className="w-3 h-3 text-zinc-500 group-hover:text-blue-400 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
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
                {contactName} is interested in our enterprise solution and has
                requested a product demo. This is a qualified lead with high
                engagement.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-purple-500/30 text-purple-400 text-xs"
                >
                  AI Generated
                </Badge>
                <span className="text-xs text-zinc-500">Updated 2 min ago</span>
              </div>
            </div>
          </div>

          <Separator className="bg-zinc-800" />

          {/* Next Actions */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <h3 className="text-sm font-medium text-white">
                Recommended Actions
              </h3>
            </div>
            <div className="space-y-3">
              {NEXT_ACTIONS.map((item, index) => {
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
                          <span className="text-xs text-zinc-500">
                            Due: {item.dueDate}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-shrink-0 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                      >
                        Start
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Insights */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-400" />
              <h3 className="text-sm font-medium text-white">Quick Insights</h3>
            </div>
            <div className="space-y-2">
              <div className="bg-gradient-to-r from-orange-500/5 to-yellow-500/5 rounded-lg p-3 border border-orange-500/20">
                <p className="text-xs text-zinc-400 mb-1">Response Pattern</p>
                <p className="text-sm text-zinc-300">
                  Contact typically responds within 5-10 minutes during business
                  hours
                </p>
              </div>
              <div className="bg-gradient-to-r from-green-500/5 to-emerald-500/5 rounded-lg p-3 border border-green-500/20">
                <p className="text-xs text-zinc-400 mb-1">Engagement Level</p>
                <p className="text-sm text-zinc-300">
                  High engagement &bull; 95% response rate
                </p>
              </div>
              <div className="bg-gradient-to-r from-blue-500/5 to-cyan-500/5 rounded-lg p-3 border border-blue-500/20">
                <p className="text-xs text-zinc-400 mb-1">Best Contact Time</p>
                <p className="text-sm text-zinc-300">
                  Weekdays, 9 AM - 5 PM EST
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 p-4 border-t border-zinc-800 bg-zinc-900/50">
        <Button className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white">
          <Sparkles className="w-4 h-4 mr-2" />
          Generate More Suggestions
        </Button>
      </div>
    </div>
  );
}
