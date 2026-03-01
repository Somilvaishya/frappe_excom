import { useState, useMemo } from "react";
import { Search, MessageCircle, Mail, Phone } from "lucide-react";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import type { UnifiedContact } from "../../types";

interface MobileContactsListProps {
  contacts: UnifiedContact[];
  onSelectContact: (id: string) => void;
}

const CHANNEL_ICONS: Record<string, React.ReactElement> = {
  whatsapp: <MessageCircle className="w-3 h-3 text-green-400" />,
  email: <Mail className="w-3 h-3 text-blue-400" />,
  calls: <Phone className="w-3 h-3 text-purple-400" />,
};

export function MobileContactsList({ contacts, onSelectContact }: MobileContactsListProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(
      (c) =>
        c.contactName.toLowerCase().includes(q) ||
        c.contactInfo.phone?.toLowerCase().includes(q) ||
        c.contactInfo.email?.toLowerCase().includes(q) ||
        c.contactInfo.company?.toLowerCase().includes(q),
    );
  }, [contacts, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) =>
      a.contactName.localeCompare(b.contactName),
    );
  }, [filtered]);

  return (
    <>
      <div className="shrink-0 p-4 border-b border-zinc-800 space-y-3">
        <h2 className="text-lg font-semibold text-white">Contacts</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <p className="text-xs text-zinc-500">{sorted.length} contacts</p>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-zinc-800">
        {sorted.map((contact) => (
          <button
            key={contact.id}
            onClick={() => onSelectContact(contact.id)}
            className="w-full p-4 text-left hover:bg-zinc-800/50 active:bg-zinc-800 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                {contact.contactAvatar ? (
                  <img
                    src={contact.contactAvatar}
                    alt={contact.contactName}
                    className="w-11 h-11 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                    {contact.contactName
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-white text-sm truncate">
                  {contact.contactName}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  {contact.contactInfo.phone && (
                    <span className="text-xs text-zinc-400 truncate">
                      {contact.contactInfo.phone}
                    </span>
                  )}
                  {contact.contactInfo.company && (
                    <Badge
                      variant="outline"
                      className="text-[10px] border-zinc-700 text-zinc-500 shrink-0"
                    >
                      {contact.contactInfo.company}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  {contact.channels.map((ch) => (
                    <span key={ch}>{CHANNEL_ICONS[ch]}</span>
                  ))}
                </div>
              </div>
            </div>
          </button>
        ))}
        {sorted.length === 0 && (
          <div className="flex items-center justify-center h-40">
            <p className="text-sm text-zinc-500">No contacts found</p>
          </div>
        )}
      </div>
    </>
  );
}
