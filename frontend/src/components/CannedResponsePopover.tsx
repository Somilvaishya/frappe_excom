import { useState, useEffect, useRef, useCallback } from "react";
import { Zap, Search, Loader2 } from "lucide-react";
import { Badge } from "./ui/badge";
import { useCannedResponses } from "../hooks/useCannedResponses";

interface CannedResponsePopoverProps {
  isOpen: boolean;
  searchText: string;
  channel?: string;
  onSelect: (content: string) => void;
  onClose: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  General: "bg-zinc-300/10 text-zinc-600 border-zinc-300/20",
  Sales: "bg-green-500/10 text-green-700 border-green-500/20",
  Support: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  Billing: "bg-orange-500/10 text-orange-700 border-orange-500/20",
};

export function CannedResponsePopover({
  isOpen,
  searchText,
  channel,
  onSelect,
  onClose,
}: CannedResponsePopoverProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const { responses, isLoading } = useCannedResponses(
    isOpen ? searchText : null,
    channel,
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [searchText, responses.length]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || responses.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, responses.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        onSelect(responses[activeIndex].content);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [isOpen, responses, activeIndex, onSelect, onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  useEffect(() => {
    if (listRef.current && activeIndex >= 0) {
      const el = listRef.current.children[activeIndex] as HTMLElement;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  if (!isOpen) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 z-50">
      <div className="bg-zinc-50 border border-zinc-300 rounded-xl shadow-2xl overflow-hidden max-h-72">
        <div className="px-3 py-2 border-b border-zinc-200 flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-yellow-700" />
          <span className="text-xs font-medium text-zinc-700">
            Canned Responses
          </span>
          {searchText && (
            <span className="text-[10px] text-zinc-600 ml-auto">
              /{searchText}
            </span>
          )}
        </div>

        <div ref={listRef} className="max-h-56 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
            </div>
          ) : responses.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-xs text-zinc-600">No matching responses</p>
              <p className="text-[10px] text-zinc-500 mt-1">
                Create one in Excom Canned Response
              </p>
            </div>
          ) : (
            responses.map((response, index) => (
              <button
                key={response.name}
                onClick={() => onSelect(response.content)}
                className={`w-full text-left px-3 py-2.5 transition-colors border-b border-zinc-200/50 last:border-0 ${
                  index === activeIndex
                    ? "bg-blue-500/10"
                    : "hover:bg-zinc-100/50"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-zinc-900 truncate">
                    {response.title}
                  </span>
                  <span className="text-[10px] text-zinc-600 font-mono">
                    /{response.shortcode}
                  </span>
                  <Badge
                    className={`ml-auto text-[9px] px-1.5 h-4 border ${
                      CATEGORY_COLORS[response.category] ||
                      CATEGORY_COLORS.General
                    }`}
                  >
                    {response.category}
                  </Badge>
                </div>
                <p className="text-[11px] text-zinc-600 line-clamp-2 leading-relaxed">
                  {response.content}
                </p>
              </button>
            ))
          )}
        </div>

        <div className="px-3 py-1.5 border-t border-zinc-200 bg-zinc-50/80">
          <span className="text-[10px] text-zinc-500">
            ↑↓ navigate · Enter select · Esc close
          </span>
        </div>
      </div>
    </div>
  );
}
