import { Search, MessageCircle, ChevronDown, Tag, X } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useTags } from "../hooks/useTags";

interface LeftSidebarProps {
  selectedChannel: string;
  onChannelSelect: (channel: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalConversations: number;
  totalUnread: number;
  selectedTags?: string[];
  onTagFilterChange?: (tags: string[]) => void;
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
}: LeftSidebarProps) {
  const { tags: allTags } = useTags();
  return (
    <div className="w-64 bg-gradient-to-b from-zinc-900 to-zinc-950 border-r border-zinc-800 flex flex-col h-full shrink-0 overflow-hidden">
      <div className="shrink-0 p-4 border-b border-zinc-800">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between bg-zinc-800/50 border-zinc-700 text-white hover:bg-zinc-800 hover:text-white"
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
