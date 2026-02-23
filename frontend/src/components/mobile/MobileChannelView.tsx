import { useState, useMemo, useEffect, useRef } from "react";
import { ArrowLeft, Phone, Video, Info, Send, Paperclip, Smile, Check, CheckCheck, MessageCircle, Mail, Instagram, Bot, UserCheck, Loader2 } from "lucide-react";
import { useFrappePostCall } from "frappe-react-sdk";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import type { UnifiedContact } from "../../types";
import { useMessages } from "../../hooks/useMessages";
import { format } from "date-fns";

interface MobileChannelViewProps {
  contact: UnifiedContact;
  onBack: () => void;
  onCall: (type: "voice" | "video") => void;
  onOpenContact: () => void;
  onOpenAI: () => void;
}

const CHANNEL_ICONS: Record<string, React.ReactElement> = {
  whatsapp: <MessageCircle className="w-3 h-3" />,
  email: <Mail className="w-3 h-3" />,
  instagram: <Instagram className="w-3 h-3" />,
  calls: <Phone className="w-3 h-3" />,
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  instagram: "IG",
  calls: "Calls",
};

function getChannelIcon(channel?: string) {
  if (!channel) return null;
  return CHANNEL_ICONS[channel] || null;
}

export function MobileChannelView({ contact, onBack, onCall, onOpenContact, onOpenAI }: MobileChannelViewProps) {
  const [messageInput, setMessageInput] = useState("");
  const [selectedChannel, setSelectedChannel] = useState(contact.channels[0]);
  const [selectedAccountId, setSelectedAccountId] = useState(contact.activeAccountId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedChannel(contact.channels[0]);
    setSelectedAccountId(contact.activeAccountId);
  }, [contact.id]);

  const { messages: threadMessages, isLoading: messagesLoading, refresh } =
    useMessages(selectedAccountId || "");

  const { call: sendMessageCall, loading: isSending } = useFrappePostCall(
    "excom.excom.api.chat.send_message"
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threadMessages]);

  const handleSendMessage = async () => {
    const text = messageInput.trim();
    if (!text || !selectedAccountId || isSending) return;

    setMessageInput("");
    try {
      await sendMessageCall({ thread_id: selectedAccountId, message: text });
      await refresh();
    } catch (err) {
      console.error("Failed to send message:", err);
      setMessageInput(text);
    }
  };

  const accountsByChannel = useMemo(() => {
    const grouped: Record<string, typeof contact.allAccounts> = {};
    contact.allAccounts.forEach((account) => {
      if (!grouped[account.channel]) grouped[account.channel] = [];
      grouped[account.channel].push(account);
    });
    return grouped;
  }, [contact.allAccounts]);

  const selectedAccount = contact.allAccounts.find((a) => a.id === selectedAccountId);
  const channelAccounts = accountsByChannel[selectedChannel] || [];
  const hasMultipleAccounts = channelAccounts.length > 1;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-zinc-950">
      {/* Header */}
      <div className="shrink-0 bg-zinc-900 border-b border-zinc-800 pb-2">
        <div className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Button onClick={onBack} variant="ghost" size="icon" className="text-zinc-400 hover:text-white flex-shrink-0 h-9 w-9">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="relative flex-shrink-0">
                {contact.contactAvatar ? (
                  <img src={contact.contactAvatar} alt={contact.contactName} className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium">
                    {contact.contactName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-zinc-900 ${contact.status === "online" ? "bg-green-500" : contact.status === "away" ? "bg-yellow-500" : "bg-zinc-600"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-white text-sm truncate">{contact.contactName}</h3>
                <p className="text-xs text-zinc-400 truncate">{contact.status === "online" ? "Active now" : "Offline"}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button onClick={() => onCall("voice")} variant="ghost" size="icon" className="text-zinc-400 hover:text-white h-9 w-9"><Phone className="w-4 h-4" /></Button>
            <Button onClick={() => onCall("video")} variant="ghost" size="icon" className="text-zinc-400 hover:text-white h-9 w-9"><Video className="w-4 h-4" /></Button>
            <Button onClick={onOpenContact} variant="ghost" size="icon" className="text-zinc-400 hover:text-white h-9 w-9"><Info className="w-4 h-4" /></Button>
          </div>
        </div>

        <div className="px-3 flex items-center gap-2">
          {contact.aiStatus === "active" ? (
            <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 border text-xs"><Bot className="w-3 h-3 mr-1" />AI Active</Badge>
          ) : (
            <Badge className="bg-green-500/10 text-green-400 border-green-500/20 border text-xs"><UserCheck className="w-3 h-3 mr-1" />Human Control</Badge>
          )}
          {contact.assignedTo && (
            <div className="flex items-center gap-1.5">
              {contact.assignedTo.avatar && <img src={contact.assignedTo.avatar} alt={contact.assignedTo.name} className="w-4 h-4 rounded-full" />}
              <span className="text-xs text-zinc-400">{contact.assignedTo.name}</span>
            </div>
          )}
        </div>

        <div className="px-3 mt-2 overflow-x-auto">
          <Tabs value={selectedChannel} onValueChange={setSelectedChannel}>
            <TabsList className="bg-zinc-800/50 border border-zinc-700 h-8">
              {contact.channels.map((channel) => {
                const accounts = accountsByChannel[channel] || [];
                return (
                  <TabsTrigger key={channel} value={channel} className="data-[state=active]:bg-zinc-700 text-xs px-3 h-7">
                    <div className="flex items-center gap-1">
                      {getChannelIcon(channel)}
                      <span>{CHANNEL_LABELS[channel] || channel}</span>
                      {accounts.length > 1 && (
                        <Badge className="ml-1 text-[9px] px-1 h-3.5 bg-blue-500/20 text-blue-300 border-0">{accounts.length}</Badge>
                      )}
                    </div>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>

        {hasMultipleAccounts && (
          <div className="px-3 mt-2">
            <div className="bg-zinc-800/30 rounded-lg p-2 space-y-1.5">
              <span className="text-[10px] text-zinc-500">Select Account:</span>
              <div className="flex flex-col gap-1.5">
                {channelAccounts.map((account) => (
                  <button
                    key={account.id}
                    onClick={() => setSelectedAccountId(account.id)}
                    disabled={!account.hasAccess}
                    className={`w-full px-2.5 py-2 rounded-md text-xs font-medium transition-all text-left ${
                      account.id === selectedAccountId ? "bg-blue-500 text-white" : account.hasAccess ? "bg-zinc-700/50 text-zinc-300 active:bg-zinc-700" : "bg-zinc-800/50 text-zinc-600"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {getChannelIcon(account.channel)}
                        <span className="truncate">{account.name}</span>
                      </div>
                      {account.id === selectedAccountId && <Badge className="text-[8px] px-1 h-3.5 bg-white/20 text-white border-0 flex-shrink-0">ACTIVE</Badge>}
                      {!account.hasAccess && <Badge className="text-[8px] px-1 h-3.5 bg-orange-500/20 text-orange-300 border-0 flex-shrink-0">No Access</Badge>}
                    </div>
                    <p className="text-[10px] opacity-75 mt-0.5 truncate">{account.identifier}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {selectedAccount && (
          <div className="px-3 mt-2">
            <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-lg p-2">
              <div className="flex items-center gap-2 text-[10px]">
                {getChannelIcon(selectedAccount.channel)}
                <span className="text-zinc-400">Via:</span>
                <span className="font-medium text-white truncate flex-1">{selectedAccount.identifier}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        <div className="space-y-3">
          {messagesLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-4" />
              <p className="text-zinc-400 text-sm">Loading messages...</p>
            </div>
          ) : threadMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-4">
              <div className="w-16 h-16 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4">
                {getChannelIcon(selectedChannel)}
              </div>
              <p className="text-zinc-400 text-sm">No messages yet</p>
              <p className="text-zinc-600 text-xs mt-1">Start a conversation with {contact.contactName}</p>
            </div>
          ) : (
            threadMessages.map((message, index) => {
              const isUser = message.sender === "user";
              const isAI = message.sender === "ai";
              const showTimestamp = index === 0 || threadMessages[index - 1].timestamp.getTime() - message.timestamp.getTime() > 300000;

              return (
                <div key={message.id}>
                  {showTimestamp && (
                    <div className="text-center text-xs text-zinc-500 my-3">{format(message.timestamp, "MMM d, h:mm a")}</div>
                  )}
                  <div className={`flex ${isUser || isAI ? "justify-end" : "justify-start"}`}>
                    <div className={`flex gap-2 max-w-[85%] ${isUser || isAI ? "flex-row-reverse" : "flex-row"}`}>
                      {!isUser && !isAI && contact.contactAvatar && (
                        <img src={contact.contactAvatar} alt={contact.contactName} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                      )}
                      <div>
                        <div className={`rounded-2xl px-3 py-2 shadow-lg ${
                          isAI ? "bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 text-white"
                          : isUser ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white"
                          : "bg-zinc-800 text-zinc-100"
                        }`}>
                          {message.type === "document" && message.mediaUrl ? (
                            <div className="flex items-center gap-2 p-1">
                              <div className="w-8 h-8 bg-zinc-700 rounded-lg flex items-center justify-center"><Paperclip className="w-4 h-4 text-zinc-300" /></div>
                              <div><p className="text-xs font-medium">{message.mediaUrl}</p><p className="text-[10px] text-zinc-400">Document</p></div>
                            </div>
                          ) : message.type === "image" && message.mediaUrl ? (
                            <img src={message.mediaUrl} alt="Attached media" className="rounded-lg max-w-[200px]" />
                          ) : (
                            <p className="text-sm leading-relaxed">{message.content}</p>
                          )}
                        </div>
                        <div className={`flex items-center gap-1.5 mt-1 text-[10px] ${isUser || isAI ? "justify-end flex-row-reverse" : "justify-start"}`}>
                          <div className="flex items-center gap-1 text-zinc-500">
                            <span>{format(message.timestamp, "h:mm a")}</span>
                            {(isUser || isAI) && (
                              message.status === "read" ? <CheckCheck className="w-3 h-3 text-blue-400" /> :
                              message.status === "delivered" ? <CheckCheck className="w-3 h-3 text-zinc-500" /> :
                              message.status === "sent" ? <Check className="w-3 h-3 text-zinc-500" /> : null
                            )}
                          </div>
                          {(isUser || isAI) && message.sentBy && (
                            <div className="flex items-center gap-1">
                              {message.sentBy.avatar && <img src={message.sentBy.avatar} alt={message.sentBy.name} className="w-3 h-3 rounded-full" />}
                              {isAI ? (
                                <Badge className="text-[9px] px-1 py-0 h-3.5 bg-purple-500/20 text-purple-300 border-purple-500/30">AI</Badge>
                              ) : (
                                <span className="text-zinc-400 text-[9px]">{message.sentBy.name}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 bg-zinc-900 border-t border-zinc-800 p-3 safe-area-bottom">
        {contact.aiStatus === "active" && (
          <div className="mb-2 flex items-center gap-2 text-[10px] text-zinc-400 bg-zinc-800/50 rounded-lg p-2">
            <Bot className="w-3 h-3 text-blue-400 flex-shrink-0" />
            <span className="flex-1">AI monitoring</span>
            <Button size="sm" className="h-6 text-[10px] px-2 bg-blue-500 hover:bg-blue-600 text-white">Take Over</Button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button onClick={onOpenAI} variant="ghost" size="icon" className="text-zinc-400 hover:text-white h-9 w-9 flex-shrink-0">
            <Smile className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0 bg-zinc-800 rounded-full border border-zinc-700 focus-within:border-blue-500 transition-colors flex items-center px-3">
            <Input
              placeholder={`Message ${selectedAccount?.identifier || "..."}...`}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              className="border-0 bg-transparent text-white placeholder:text-zinc-500 focus-visible:ring-0 h-9 px-0 text-sm"
              disabled={!selectedAccount?.hasAccess}
            />
          </div>
          {messageInput.trim() ? (
            <Button onClick={handleSendMessage} size="icon" className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 h-9 w-9 rounded-full flex-shrink-0 text-white" disabled={!selectedAccount?.hasAccess || isSending}>
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          ) : (
            <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white h-9 w-9 flex-shrink-0">
              <Paperclip className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
