import { useState, useEffect, useMemo, useCallback } from "react";
import { useFrappePostCall, useFrappeGetCall } from "frappe-react-sdk";
import { X, Loader2, Search } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "sonner";

interface Sticker {
  name: string;
  sticker_name: string;
  pack: string;
  sticker_file: string;
  media_id: string;
  is_animated: 0 | 1;
}

interface StickerPickerProps {
  threadId: string;
  onClose: () => void;
  onSent: () => void;
}

export function StickerPicker({ threadId, onClose, onSent }: StickerPickerProps) {
  const [selectedPack, setSelectedPack] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);

  const { data, isLoading } = useFrappeGetCall<{
    message: { stickers: Sticker[]; packs: string[] };
  }>("excom.excom.api.chat.get_stickers", { pack: selectedPack });

  const { call: sendMessage } = useFrappePostCall("excom.excom.api.chat.send_message");

  const stickers = data?.message?.stickers ?? [];
  const packs = data?.message?.packs ?? [];

  const filteredStickers = useMemo(() => {
    if (!searchQuery.trim()) return stickers;
    const q = searchQuery.toLowerCase();
    return stickers.filter(
      (s) =>
        s.sticker_name.toLowerCase().includes(q) ||
        s.pack.toLowerCase().includes(q),
    );
  }, [stickers, searchQuery]);

  const handleSend = useCallback(
    async (sticker: Sticker) => {
      if (!sticker.media_id && !sticker.sticker_file) {
        toast.error("Sticker has no media uploaded. Upload it from the Sticker list.");
        return;
      }
      setSendingId(sticker.name);
      try {
        await sendMessage({
          thread_id: threadId,
          message: "",
          message_type: "Sticker",
          media_url: sticker.sticker_file || "",
          sticker_name: sticker.name,
        });
        onSent();
        onClose();
      } catch (err: any) {
        toast.error(err?.message || "Failed to send sticker");
      } finally {
        setSendingId(null);
      }
    },
    [threadId, sendMessage, onSent, onClose],
  );

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-80 max-h-96 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700">
        <h3 className="text-sm font-semibold text-white">Stickers</h3>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-6 w-6 text-zinc-400 hover:text-white">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="px-3 py-2 border-b border-zinc-800">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <Input
            placeholder="Search stickers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 pl-7 text-xs bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
          />
        </div>
      </div>

      {packs.length > 1 && (
        <div className="flex gap-1 px-3 py-1.5 border-b border-zinc-800 overflow-x-auto">
          <button
            onClick={() => setSelectedPack("")}
            className={`px-2 py-0.5 text-[11px] rounded-full whitespace-nowrap transition-colors ${
              !selectedPack
                ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                : "text-zinc-400 hover:text-zinc-200 border border-zinc-700"
            }`}
          >
            All
          </button>
          {packs.map((p) => (
            <button
              key={p}
              onClick={() => setSelectedPack(p)}
              className={`px-2 py-0.5 text-[11px] rounded-full whitespace-nowrap transition-colors ${
                selectedPack === p
                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                  : "text-zinc-400 hover:text-zinc-200 border border-zinc-700"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
          </div>
        ) : filteredStickers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs text-zinc-500">
              {searchQuery ? "No stickers match your search" : "No stickers available"}
            </p>
            <p className="text-[10px] text-zinc-600 mt-1">
              Add stickers from the Excom Sticker list
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            {filteredStickers.map((sticker) => (
              <button
                key={sticker.name}
                onClick={() => handleSend(sticker)}
                disabled={sendingId === sticker.name}
                className="relative group p-1.5 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
                title={sticker.sticker_name}
              >
                {sendingId === sticker.name ? (
                  <div className="w-14 h-14 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                  </div>
                ) : (
                  <img
                    src={sticker.sticker_file}
                    alt={sticker.sticker_name}
                    className="w-14 h-14 object-contain"
                    loading="lazy"
                  />
                )}
                <span className="absolute bottom-0 left-0 right-0 text-[9px] text-zinc-500 truncate text-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {sticker.sticker_name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
