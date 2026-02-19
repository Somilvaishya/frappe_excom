import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BiSearch, BiMessageRoundedAdd } from "react-icons/bi";
import { HiOutlineDotsVertical } from "react-icons/hi";
import { useContacts } from "@/hooks/useContacts";
import ContactItem from "./ContactItem";

export default function ChatSidebar() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const navigate = useNavigate();
  const { profileId } = useParams();
  const { contacts, isLoading, refresh } = useContacts(debouncedSearch);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const interval = setInterval(() => refresh(), 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div className="w-full md:w-[420px] h-full flex flex-col bg-chat-sidebar border-r border-chat-border shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-chat-header">
        <h1 className="text-xl font-semibold text-white tracking-tight">
          Excom
        </h1>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-full hover:bg-chat-hover transition-colors text-chat-muted">
            <BiMessageRoundedAdd size={22} />
          </button>
          <button className="p-2 rounded-full hover:bg-chat-hover transition-colors text-chat-muted">
            <HiOutlineDotsVertical size={20} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="flex items-center bg-chat-input rounded-lg px-3 py-1.5 gap-3">
          <BiSearch className="text-chat-muted shrink-0" size={18} />
          <input
            type="text"
            placeholder="Search or start new chat"
            className="bg-transparent text-sm text-white placeholder-chat-muted outline-none w-full py-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Contact List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && contacts.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-chat-muted text-sm">
            Loading conversations...
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="text-chat-muted text-sm">
              {search ? "No contacts found" : "No conversations yet"}
            </div>
          </div>
        ) : (
          contacts.map((contact) => (
            <ContactItem
              key={contact.name}
              contact={contact}
              isActive={profileId === contact.name}
              onClick={() => navigate(`/${contact.name}`)}
            />
          ))
        )}
      </div>
    </div>
  );
}
