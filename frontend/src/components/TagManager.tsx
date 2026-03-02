import { useState } from "react";
import { Tag, Plus, X } from "lucide-react";
import { useTags, useThreadTags } from "../hooks/useTags";
import { Button } from "./ui/button";

interface TagManagerProps {
  threadId: string;
}

export function TagManager({ threadId }: TagManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");
  const { tags: allTags } = useTags();
  const { threadTags, addTag, removeTag } = useThreadTags(threadId);

  const appliedTagNames = new Set(threadTags.map((t) => t.tag));
  const availableTags = allTags.filter((t) => !appliedTagNames.has(t.name));

  const handleAddTag = async (tagName: string) => {
    await addTag(tagName);
    setNewTagInput("");
  };

  const handleCreateAndAdd = async () => {
    const name = newTagInput.trim();
    if (!name) return;
    await addTag(name);
    setNewTagInput("");
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
      >
        <Tag className="w-3.5 h-3.5" />
        Tags
        {threadTags.length > 0 && (
          <span className="bg-blue-500/20 text-blue-400 text-[10px] px-1.5 rounded-full">
            {threadTags.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl">
          <div className="p-3 border-b border-zinc-700">
            <h4 className="text-xs font-medium text-zinc-300 mb-2">Applied Tags</h4>
            {threadTags.length === 0 ? (
              <p className="text-[10px] text-zinc-500">No tags</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {threadTags.map((tag) => (
                  <span
                    key={tag.tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                    style={{
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                      border: `1px solid ${tag.color}40`,
                    }}
                  >
                    {tag.tag_name}
                    <button
                      onClick={() => removeTag(tag.tag)}
                      className="hover:opacity-70"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="p-3">
            <h4 className="text-xs font-medium text-zinc-300 mb-2">Available Tags</h4>
            {availableTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2 max-h-32 overflow-y-auto">
                {availableTags.map((tag) => (
                  <button
                    key={tag.name}
                    onClick={() => handleAddTag(tag.name)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs hover:opacity-80 transition-opacity"
                    style={{
                      backgroundColor: `${tag.color}15`,
                      color: tag.color,
                      border: `1px solid ${tag.color}30`,
                    }}
                  >
                    <Plus className="w-3 h-3" />
                    {tag.tag_name}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateAndAdd();
                }}
                placeholder="New tag name..."
                className="flex-1 px-2 py-1 text-xs bg-zinc-900 border border-zinc-700 rounded text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500"
              />
              <Button
                size="sm"
                onClick={handleCreateAndAdd}
                disabled={!newTagInput.trim()}
                className="h-6 px-2 text-xs"
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>

          <div className="px-3 pb-2">
            <button
              onClick={() => setIsOpen(false)}
              className="w-full text-center text-[10px] text-zinc-500 hover:text-zinc-300 py-1"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
