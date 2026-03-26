import { useState, useEffect } from "react";
import { Search, MessageCircle, ChevronDown, Tag, X, Users, Shield, GitMerge, Cog, Plus, Radio } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useTags } from "../hooks/useTags";
import { useFrappePostCall, useFrappeGetCall } from "frappe-react-sdk";

interface BrandingData {
  logo_gradient_from: string;
  logo_gradient_to: string;
  show_app_name: boolean;
  app_name: string;
}

interface LeftSidebarProps {
  selectedChannel: string;
  onChannelSelect: (channel: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalConversations: number;
  totalUnread: number;
  selectedTags?: string[];
  onTagFilterChange?: (tags: string[]) => void;
  onNavigateToSubscribers?: () => void;
  onNavigateToTeams?: () => void;
  onNavigateToMergeSuggestions?: () => void;
  onNavigateToSubscriberRules?: () => void;
  onNavigateToBroadcasts?: () => void;
  selectedTeamFilter?: string;
  onTeamFilterChange?: (team: string) => void;
  onNewConversation?: () => void;
}

const CHANNEL_LABELS: Record<string, string> = {
  all: "All Channels",
  whatsapp: "WhatsApp",
  calls: "Calls",
  instagram: "Instagram",
  email: "Email",
};

export function LeftSidebar({
  selectedChannel,
  onChannelSelect,
  searchQuery,
  onSearchChange,
  totalConversations,
  totalUnread,
  selectedTags = [],
  onTagFilterChange,
  onNavigateToSubscribers,
  onNavigateToTeams,
  onNavigateToMergeSuggestions,
  onNavigateToSubscriberRules,
  onNavigateToBroadcasts,
  selectedTeamFilter = "",
  onTeamFilterChange,
  onNewConversation,
}: LeftSidebarProps) {
  const { tags: allTags } = useTags();
  const [myTeams, setMyTeams] = useState<{ name: string; team_name: string }[]>([]);
  const [mergeBadge, setMergeBadge] = useState(0);
  const { call: fetchMyTeams } = useFrappePostCall("excom.excom.api.teams.get_my_teams");
  const { call: fetchMergeCount } = useFrappePostCall("excom.excom.api.merge_suggestions.get_suggestion_count");
  const { data: brandingRaw } = useFrappeGetCall<{ message: BrandingData }>(
    "excom.excom.doctype.excom_settings.excom_settings.get_branding"
  );
  const branding = brandingRaw?.message;

  useEffect(() => {
    fetchMyTeams({}).then((res) => {
      setMyTeams((res as any)?.message || []);
    }).catch(() => {});
    fetchMergeCount({}).then((res) => {
      setMergeBadge((res as any)?.message?.count || 0);
    }).catch(() => {});
  }, []);
  return (
    <div className="w-64 bg-gradient-to-b from-zinc-900 to-zinc-950 border-r border-zinc-800 flex flex-col h-full shrink-0 overflow-hidden">
      <div className="shrink-0 p-4 border-b border-zinc-800">
        {branding?.show_app_name && branding.app_name && (
          <div className="mb-3 text-[11px] font-semibold tracking-wider uppercase text-zinc-400">
            {branding.app_name}
          </div>
        )}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{
              background: `linear-gradient(to bottom right, ${branding?.logo_gradient_from || "#3b82f6"}, ${branding?.logo_gradient_to || "#9333ea"})`,
            }}
          >
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-white">Excom</h1>
            <p className="text-xs text-zinc-400">Communication Hub</p>
          </div>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="flex-1 justify-between bg-zinc-800/50 border-zinc-700 text-white hover:bg-zinc-800 hover:text-white"
              >
                <span>{CHANNEL_LABELS[selectedChannel] || "All Channels"}</span>
                <ChevronDown className="w-4 h-4 ml-2 text-zinc-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              {Object.entries(CHANNEL_LABELS).map(([key, label]) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => onChannelSelect(key)}
                  className="cursor-pointer"
                >
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {onNewConversation && (
            <Button
              size="icon"
              onClick={onNewConversation}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shrink-0"
              title="New Conversation"
            >
              <Plus className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="shrink-0 p-4 border-b border-zinc-800">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <div className="text-2xl font-semibold text-white">
              {totalConversations}
            </div>
            <div className="text-xs text-zinc-400">Total Chats</div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <div className="text-2xl font-semibold text-blue-400">
              {totalUnread}
            </div>
            <div className="text-xs text-zinc-400">Unread</div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {allTags.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Tag className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-xs font-medium text-zinc-400">Filter by Tag</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {allTags.map((tag) => {
                const isSelected = selectedTags.includes(tag.name);
                return (
                  <button
                    key={tag.name}
                    onClick={() => {
                      if (!onTagFilterChange) return;
                      if (isSelected) {
                        onTagFilterChange(selectedTags.filter((t) => t !== tag.name));
                      } else {
                        onTagFilterChange([...selectedTags, tag.name]);
                      }
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-all"
                    style={{
                      backgroundColor: isSelected ? `${tag.color}30` : `${tag.color}10`,
                      color: tag.color,
                      border: `1px solid ${isSelected ? tag.color : `${tag.color}30`}`,
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.tag_name}
                    {isSelected && <X className="w-3 h-3 ml-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {myTeams.length > 0 && onTeamFilterChange && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Shield className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-xs font-medium text-zinc-400">Team Filter</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => onTeamFilterChange("")}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-all border ${
                  selectedTeamFilter === ""
                    ? "bg-blue-500/20 text-blue-400 border-blue-500"
                    : "bg-zinc-800/50 text-zinc-400 border-zinc-700 hover:text-zinc-300"
                }`}
              >
                All
              </button>
              {myTeams.map((t) => (
                <button
                  key={t.name}
                  onClick={() => onTeamFilterChange(t.name === "General" ? "__general__" : t.name)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-all border ${
                    (t.name === "General" ? "__general__" : t.name) === selectedTeamFilter
                      ? t.name === "General"
                        ? "bg-amber-500/20 text-amber-400 border-amber-500"
                        : "bg-blue-500/20 text-blue-400 border-blue-500"
                      : "bg-zinc-800/50 text-zinc-400 border-zinc-700 hover:text-zinc-300"
                  }`}
                >
                  {t.team_name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-0.5">
          {onNavigateToSubscribers && (
            <button
              onClick={onNavigateToSubscribers}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <Users className="w-4 h-4 text-blue-400" />
              Subscriber Lists
            </button>
          )}

          {onNavigateToTeams && (
            <button
              onClick={onNavigateToTeams}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <Shield className="w-4 h-4 text-purple-400" />
              Teams
            </button>
          )}

          {onNavigateToMergeSuggestions && (
            <button
              onClick={onNavigateToMergeSuggestions}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <span className="flex items-center gap-2.5">
                <GitMerge className="w-4 h-4 text-green-400" />
                Merge Suggestions
              </span>
              {mergeBadge > 0 && (
                <span className="bg-green-500/20 text-green-400 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                  {mergeBadge}
                </span>
              )}
            </button>
          )}

          {onNavigateToSubscriberRules && (
            <button
              onClick={onNavigateToSubscriberRules}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <Cog className="w-4 h-4 text-amber-400" />
              Subscriber Rules
            </button>
          )}

          {onNavigateToBroadcasts && (
            <button
              onClick={onNavigateToBroadcasts}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <Radio className="w-4 h-4 text-emerald-400" />
              Broadcasts
            </button>
          )}
        </div>

        <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-lg p-4 border border-blue-500/20">
          <h3 className="text-sm font-medium text-white mb-2">
            AI-Powered Communication
          </h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Conversations are automatically handled by AI until a team member
            takes over. Real-time status tracking ensures seamless handoffs.
          </p>
        </div>
      </div>
    </div>
  );
}
