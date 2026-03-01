import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  Smile,
  Bot,
  UserCheck,
  Check,
  CheckCheck,
  MessageCircle,
  Mail,
  Instagram,
  Phone,
  Loader2,
  Lock,
  StickyNote,
} from "lucide-react";
import { useFrappePostCall } from "frappe-react-sdk";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import type { UnifiedContact } from "../types";
import { useMessages } from "../hooks/useMessages";
import { useRealtimeMessages } from "../hooks/useRealtimeMessages";
import { useFileUpload } from "../hooks/useFileUpload";
import { CannedResponsePopover } from "./CannedResponsePopover";
import { EmailMessageCard } from "./EmailMessageCard";
import { EmailCompose } from "./EmailCompose";
import { useEmailBody } from "../hooks/useEmailBody";
import { format } from "date-fns";
import { toast } from "sonner";

interface ChannelTabsViewProps {
  contact: UnifiedContact;
  onOpenAIAssistant: () => void;
  activeAccountId?: string;
  onAccountSwitch?: (accountId: string) => void;
}

const CHANNEL_ICONS: Record<string, React.ReactElement> = {
  whatsapp: <MessageCircle className="w-4 h-4" />,
  email: <Mail className="w-4 h-4" />,
  instagram: <Instagram className="w-4 h-4" />,
  calls: <Phone className="w-4 h-4" />,
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  instagram: "Instagram",
  calls: "Calls",
};

function getChannelIcon(channel?: string) {
  if (!channel) return null;
  return CHANNEL_ICONS[channel] || null;
}

function DeliveryIcon({ status }: { status?: string }) {
  switch (status) {
    case "sent":
      return <Check className="w-3 h-3 text-zinc-500" />;
    case "delivered":
      return <CheckCheck className="w-3 h-3 text-zinc-500" />;
    case "read":
      return <CheckCheck className="w-3 h-3 text-blue-400" />;
    default:
      return null;
  }
}

export function ChannelTabsView({
  contact,
  onOpenAIAssistant,
  activeAccountId: parentAccountId,
  onAccountSwitch,
}: ChannelTabsViewProps) {
  const [messageInput, setMessageInput] = useState("");
  const [selectedChannel, setSelectedChannel] = useState(contact.channels[0]);
  const [selectedAccountId, setSelectedAccountId] = useState(
    parentAccountId || contact.activeAccountId
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedChannel(contact.channels[0]);
    setSelectedAccountId(parentAccountId || contact.activeAccountId);
  }, [contact.id]);

  useEffect(() => {
    if (parentAccountId && parentAccountId !== selectedAccountId) {
      setSelectedAccountId(parentAccountId);
      const account = contact.allAccounts.find((a) => a.id === parentAccountId);
      if (account) setSelectedChannel(account.channel);
    }
  }, [parentAccountId]);

  const { messages: threadMessages, isLoading: messagesLoading, refresh } =
    useMessages(selectedAccountId || "");

  const handleRealtimeMessage = useCallback(() => {
    refresh();
  }, [refresh]);
  useRealtimeMessages(selectedAccountId, handleRealtimeMessage);

  const [isNoteMode, setIsNoteMode] = useState(false);
  const [showCannedPopover, setShowCannedPopover] = useState(false);
  const [cannedSearch, setCannedSearch] = useState("");

  const isEmailChannel = selectedChannel === "email";
  const { bodies: emailBodies, loading: emailBodyLoading, fetchBody: fetchEmailBody } = useEmailBody();
  const [emailCompose, setEmailCompose] = useState<{
    show: boolean;
    to: string;
    subject: string;
    inReplyToGmailId: string;
  }>({ show: false, to: "", subject: "", inReplyToGmailId: "" });

  const handleReplyEmail = useCallback(
    (gmailMsgId: string, subject: string, to: string) => {
      setEmailCompose({ show: true, to, subject, inReplyToGmailId: gmailMsgId });
    },
    [],
  );

  const { call: sendMessageCall, loading: isSending } = useFrappePostCall(
    "excom.excom.api.chat.send_message"
  );

  const { call: sendNoteCall, loading: isSendingNote } = useFrappePostCall(
    "excom.excom.api.chat.send_internal_note"
  );

  const { call: assignThreadCall } = useFrappePostCall(
    "excom.excom.api.chat.assign_thread"
  );

  const handleFileReady = useCallback(
    async (fileUrl: string, messageType: string, _fileName: string) => {
      if (!selectedAccountId) return;
      try {
        await sendMessageCall({
          thread_id: selectedAccountId,
          message: "",
          message_type: messageType,
          media_url: fileUrl,
        });
        await refresh();
      } catch (err) {
        toast.error("Failed to send attachment");
      }
    },
    [selectedAccountId, sendMessageCall, refresh],
  );

  const {
    inputRef: fileInputRef,
    openFilePicker,
    handleFileChange,
    uploading,
    isDragging,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    acceptedTypes,
  } = useFileUpload(handleFileReady);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threadMessages]);

  const [optimisticMessages, setOptimisticMessages] = useState<
    { id: string; content: string; timestamp: Date }[]
  >([]);

  const handleSendMessage = async () => {
    const text = messageInput.trim();
    if (!text || !selectedAccountId || isSending || isSendingNote) return;

    if (isNoteMode) {
      setMessageInput("");
      try {
        await sendNoteCall({ thread_id: selectedAccountId, content: text });
        await refresh();
        toast.success("Internal note added");
      } catch (err) {
        setMessageInput(text);
        toast.error("Failed to add note");
      }
      return;
    }

    const tempId = `opt_${Date.now()}`;
    setMessageInput("");
    setOptimisticMessages((prev) => [
      ...prev,
      { id: tempId, content: text, timestamp: new Date() },
    ]);

    try {
      await sendMessageCall({ thread_id: selectedAccountId, message: text });
      setOptimisticMessages((prev) => prev.filter((m) => m.id !== tempId));
      await refresh();
    } catch (err) {
      setOptimisticMessages((prev) => prev.filter((m) => m.id !== tempId));
      setMessageInput(text);
      toast.error("Failed to send message");
    }
  };

  const handleInputChange = (value: string) => {
    if (value.length > CHAR_LIMIT) return;
    setMessageInput(value);

    if (!isNoteMode && value.startsWith("/") && value.length > 1) {
      setShowCannedPopover(true);
      setCannedSearch(value.slice(1));
    } else if (!value.startsWith("/")) {
      setShowCannedPopover(false);
      setCannedSearch("");
    }
  };

  const handleCannedSelect = (content: string) => {
    setMessageInput(content);
    setShowCannedPopover(false);
    setCannedSearch("");
  };

  const CHAR_LIMIT = 4096;

  const accountsByChannel = useMemo(() => {
    const grouped: Record<string, typeof contact.allAccounts> = {};
    contact.allAccounts.forEach((account) => {
      if (!grouped[account.channel]) {
        grouped[account.channel] = [];
      }
      grouped[account.channel].push(account);
    });
    return grouped;
  }, [contact.allAccounts]);

  const selectedAccount = contact.allAccounts.find(
    (a) => a.id === selectedAccountId
  );
  const channelAccounts = accountsByChannel[selectedChannel] || [];
  const hasMultipleAccounts = channelAccounts.length > 1;

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-zinc-950">
      {/* Header */}
      <div className="shrink-0 bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-800">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                {contact.contactAvatar ? (
                  <img
                    src={contact.contactAvatar}
                    alt={contact.contactName}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-zinc-700"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 ring-2 ring-zinc-700 flex items-center justify-center text-white text-sm font-medium">
                    {contact.contactName
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                )}
                <div
                  className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-zinc-900 ${
                    contact.status === "online"
                      ? "bg-green-500"
                      : contact.status === "away"
                      ? "bg-yellow-500"
                      : "bg-zinc-600"
                  }`}
                />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-white truncate">
                  {contact.contactName}
                </h3>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-zinc-400 truncate">
                    {contact.status === "online"
                      ? "Active now"
                      : `Last seen ${format(contact.timestamp, "h:mm a")}`}
                  </p>
                  {contact.assignedTo && (
                    <>
                      <span className="text-zinc-600 shrink-0">&bull;</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {contact.assignedTo.avatar && (
                          <img
                            src={contact.assignedTo.avatar}
                            alt={contact.assignedTo.name}
                            className="w-4 h-4 rounded-full"
                          />
                        )}
                        <span className="text-xs text-zinc-400">
                          Assigned to {contact.assignedTo.name}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {contact.aiStatus === "active" ? (
                <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 border">
                  <Bot className="w-3 h-3 mr-1" />
                  AI Active
                </Badge>
              ) : (
                <Badge className="bg-green-500/10 text-green-400 border-green-500/20 border">
                  <UserCheck className="w-3 h-3 mr-1" />
                  Human Control
                </Badge>
              )}
              <Button
                onClick={onOpenAIAssistant}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
              >
                <Smile className="w-4 h-4 mr-2" />
                AI Assist
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Channel Tabs */}
      <div className="shrink-0 bg-zinc-900/60 border-b border-zinc-800">
        <Tabs
          value={selectedChannel}
          onValueChange={setSelectedChannel}
          className="w-full"
        >
          <TabsList className="w-full justify-start bg-transparent border-0 p-0 h-auto rounded-none">
            {contact.channels.map((channel) => {
              const accounts = accountsByChannel[channel] || [];
              return (
                <TabsTrigger
                  key={channel}
                  value={channel}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-zinc-800/50 px-6 py-3 data-[state=active]:shadow-none"
                >
                  <div className="flex items-center gap-2">
                    {getChannelIcon(channel)}
                    <span>{CHANNEL_LABELS[channel] || channel}</span>
                    {accounts.length > 1 && (
                      <Badge className="ml-1 text-[9px] px-1.5 h-4 bg-blue-500/20 text-blue-300 border-0">
                        {accounts.length}
                      </Badge>
                    )}
                  </div>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>

      {/* Account Selector */}
      {hasMultipleAccounts && (
        <div className="shrink-0 bg-zinc-900/40 border-b border-zinc-800 px-4 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-400">Account:</span>
            {channelAccounts.map((account) => (
              <button
                key={account.id}
                onClick={() => {
                  setSelectedAccountId(account.id);
                  onAccountSwitch?.(account.id);
                }}
                disabled={!account.hasAccess}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  account.id === selectedAccountId
                    ? "bg-blue-500 text-white"
                    : account.hasAccess
                    ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                    : "bg-zinc-800/50 text-zinc-600 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {getChannelIcon(account.channel)}
                  <span>{account.name}</span>
                  <span className="text-[10px] opacity-75">
                    ({account.identifier})
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active Account Banner */}
      {selectedAccount && (
        <div className="shrink-0 px-4 py-2 bg-zinc-900/60 border-b border-zinc-800">
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-lg p-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs min-w-0">
                {getChannelIcon(selectedAccount.channel)}
                <span className="text-zinc-400 shrink-0">Viewing & replying via:</span>
                <span className="font-medium text-white truncate">
                  {selectedAccount.name} ({selectedAccount.identifier})
                </span>
              </div>
              {!selectedAccount.hasAccess && (
                <Badge className="text-[9px] px-2 h-5 bg-orange-500/20 text-orange-300 border-orange-500/30 shrink-0">
                  No Access
                </Badge>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes}
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Messages - scrollable area */}
      <div
        className={`flex-1 min-h-0 overflow-y-auto p-6 ${isDragging ? "ring-2 ring-blue-500 ring-inset bg-blue-500/5" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="space-y-4 max-w-4xl mx-auto">
          {messagesLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-4" />
              <p className="text-zinc-400 text-sm">Loading messages...</p>
            </div>
          ) : threadMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-16 h-16 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4">
                {getChannelIcon(selectedChannel)}
              </div>
              <p className="text-zinc-400 text-sm">No messages yet</p>
              <p className="text-zinc-600 text-xs mt-1">
                Start a conversation with {contact.contactName}
              </p>
            </div>
          ) : (
            threadMessages.map((message, index) => {
              const isUser = message.sender === "user";
              const isAI = message.sender === "ai";
              const isNote = message.isInternal;
              const showTimestamp =
                index === 0 ||
                threadMessages[index - 1].timestamp.getTime() -
                  message.timestamp.getTime() >
                  300000;

              return (
                <div key={message.id}>
                  {showTimestamp && (
                    <div className="text-center text-xs text-zinc-500 my-4">
                      {format(
                        message.timestamp,
                        "EEEE, MMMM d, yyyy \u2022 h:mm a"
                      )}
                    </div>
                  )}

                  {message.isEmail ? (
                    <EmailMessageCard
                      messageId={message.id}
                      direction={message.rawDirection || (message.sender === "user" ? "Outbound" : "Inbound")}
                      snippet={message.content}
                      timestamp={message.timestamp}
                      contentJson={message.contentJson || "{}"}
                      sentBy={message.sentBy}
                      bodyData={emailBodies[message.id]}
                      bodyLoading={emailBodyLoading[message.id]}
                      onExpandEmail={fetchEmailBody}
                      onReplyEmail={handleReplyEmail}
                    />
                  ) : isNote ? (
                    <div className="flex justify-center my-2">
                      <div className="max-w-[80%] w-full">
                        <div className="rounded-xl p-3 bg-amber-500/10 border border-amber-500/20 shadow-lg">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Lock className="w-3 h-3 text-amber-400" />
                            <Badge className="text-[10px] px-1.5 h-4 bg-amber-500/20 text-amber-400 border-amber-500/30 border">
                              Internal Note
                            </Badge>
                            {message.sentBy && (
                              <span className="text-[10px] text-amber-400/70 ml-auto">
                                {message.sentBy.name}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-amber-100/90 leading-relaxed">
                            {message.content}
                          </p>
                          <div className="flex items-center gap-1 mt-2 text-[10px] text-amber-400/50">
                            <span>{format(message.timestamp, "h:mm a")}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`flex ${
                        isUser || isAI ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`flex gap-2 max-w-[70%] ${
                          isUser || isAI ? "flex-row-reverse" : "flex-row"
                        }`}
                      >
                        {!isUser && !isAI && contact.contactAvatar && (
                          <img
                            src={contact.contactAvatar}
                            alt={contact.contactName}
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                          />
                        )}

                        <div>
                          <div
                            className={`rounded-2xl p-3 shadow-lg ${
                              isAI
                                ? "bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 text-white"
                                : isUser
                                ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white"
                                : "bg-zinc-800 text-zinc-100"
                            }`}
                          >
                            {message.type === "document" && message.mediaUrl ? (
                              <div className="flex items-center gap-3 p-2">
                                <div className="w-10 h-10 bg-zinc-700 rounded-lg flex items-center justify-center">
                                  <Paperclip className="w-5 h-5 text-zinc-300" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium">
                                    {message.mediaUrl}
                                  </p>
                                  <p className="text-xs text-zinc-400">
                                    Document
                                  </p>
                                </div>
                              </div>
                            ) : message.type === "image" && message.mediaUrl ? (
                              <img
                                src={message.mediaUrl}
                                alt="Attached media"
                                className="rounded-lg max-w-sm"
                              />
                            ) : (
                              <p className="text-sm leading-relaxed">
                                {message.content}
                              </p>
                            )}
                          </div>

                          <div
                            className={`flex items-center gap-2 mt-1 text-xs ${
                              isUser || isAI
                                ? "justify-end flex-row-reverse"
                                : "justify-start"
                            }`}
                          >
                            <div className="flex items-center gap-1 text-zinc-500">
                              <span>{format(message.timestamp, "h:mm a")}</span>
                              {(isUser || isAI) && (
                                <DeliveryIcon status={message.status} />
                              )}
                            </div>
                            {(isUser || isAI) && message.sentBy && (
                              <div className="flex items-center gap-1.5">
                                {message.sentBy.avatar && (
                                  <img
                                    src={message.sentBy.avatar}
                                    alt={message.sentBy.name}
                                    className="w-4 h-4 rounded-full"
                                  />
                                )}
                                {isAI ? (
                                  <Badge className="text-[10px] px-1.5 py-0 h-4 bg-purple-500/20 text-purple-300 border-purple-500/30">
                                    <Bot className="w-2.5 h-2.5 mr-0.5" />
                                    AI
                                  </Badge>
                                ) : (
                                  <span className="text-zinc-400 text-[10px]">
                                    {message.sentBy.name}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
          {/* Optimistic (pending) messages */}
          {optimisticMessages.map((msg) => (
            <div key={msg.id} className="flex justify-end">
              <div className="max-w-[70%]">
                <div className="rounded-2xl p-3 shadow-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white opacity-70">
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                </div>
                <div className="flex items-center gap-1 mt-1 justify-end text-xs text-zinc-500">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Sending...</span>
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Email Compose */}
      {isEmailChannel && emailCompose.show && selectedAccountId && (
        <EmailCompose
          threadId={selectedAccountId}
          defaultTo={emailCompose.to}
          defaultSubject={emailCompose.subject}
          inReplyToGmailId={emailCompose.inReplyToGmailId}
          onClose={() => setEmailCompose({ show: false, to: "", subject: "", inReplyToGmailId: "" })}
          onSent={() => refresh()}
        />
      )}

      {/* Input Area */}
      <div className={`shrink-0 backdrop-blur-sm border-t p-4 ${isNoteMode ? "bg-amber-500/5 border-amber-500/20" : "bg-zinc-900/80 border-zinc-800"}`}>
        <div className="max-w-4xl mx-auto">
          {/* Email compose button for email channels */}
          {isEmailChannel && !emailCompose.show && (
            <div className="mb-3 flex items-center gap-2">
              <button
                onClick={() => {
                  const contactEmail = contact.contactInfo.email || "";
                  setEmailCompose({ show: true, to: contactEmail, subject: "", inReplyToGmailId: "" });
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-xs font-medium rounded-lg border border-blue-500/20 transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                Compose Email
              </button>
            </div>
          )}

          {contact.aiStatus === "active" && (
            <div className="mb-3 flex items-center gap-2 text-xs text-zinc-400">
              <Bot className="w-4 h-4 text-blue-400 shrink-0" />
              <span>
                AI is actively monitoring this conversation. Messages will be
                sent by AI unless you take over.
              </span>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto border-blue-500/50 text-blue-400 hover:bg-blue-500/10 shrink-0"
                onClick={async () => {
                  if (!selectedAccountId) return;
                  try {
                    await assignThreadCall({ thread_id: selectedAccountId });
                    toast.success("Thread assigned to you");
                  } catch (err) {
                    toast.error("Failed to take over");
                  }
                }}
              >
                Take Over
              </Button>
            </div>
          )}

          {/* Message / Note Toggle */}
          <div className="flex items-center gap-1 mb-2">
            <button
              onClick={() => { setIsNoteMode(false); setShowCannedPopover(false); }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                !isNoteMode
                  ? "bg-blue-500 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              <MessageCircle className="w-3 h-3 inline mr-1" />
              Message
            </button>
            <button
              onClick={() => { setIsNoteMode(true); setShowCannedPopover(false); }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                isNoteMode
                  ? "bg-amber-500 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              <StickyNote className="w-3 h-3 inline mr-1" />
              Note
            </button>
            {isNoteMode && (
              <span className="text-[10px] text-amber-400/70 ml-2 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Only visible to your team
              </span>
            )}
          </div>

          <div className="flex items-end gap-3">
            {!isNoteMode && (
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-zinc-400 hover:text-white"
                  onClick={openFilePicker}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Paperclip className="w-5 h-5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-zinc-400 hover:text-white"
                  onClick={openFilePicker}
                  disabled={uploading}
                >
                  <ImageIcon className="w-5 h-5" />
                </Button>
              </div>
            )}

            <div className="flex-1 min-w-0 relative">
              <CannedResponsePopover
                isOpen={showCannedPopover}
                searchText={cannedSearch}
                channel={selectedAccount?.channel}
                onSelect={handleCannedSelect}
                onClose={() => { setShowCannedPopover(false); setCannedSearch(""); }}
              />
              <div className={`rounded-xl border transition-colors ${
                isNoteMode
                  ? "bg-amber-500/10 border-amber-500/30 focus-within:border-amber-400"
                  : "bg-zinc-800 border-zinc-700 focus-within:border-blue-500"
              }`}>
                <Input
                  placeholder={
                    isNoteMode
                      ? "Write an internal note..."
                      : `Type your message to ${selectedAccount?.identifier || "..."}... (type / for canned responses)`
                  }
                  value={messageInput}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (showCannedPopover) return;
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className={`border-0 bg-transparent focus-visible:ring-0 ${
                    isNoteMode
                      ? "text-amber-100 placeholder:text-amber-400/40"
                      : "text-white placeholder:text-zinc-500"
                  }`}
                  disabled={!selectedAccount?.hasAccess}
                />
              </div>
              {messageInput.length > CHAR_LIMIT * 0.9 && (
                <div className={`text-right text-[10px] mt-1 ${messageInput.length >= CHAR_LIMIT ? "text-red-400" : "text-zinc-500"}`}>
                  {messageInput.length}/{CHAR_LIMIT}
                </div>
              )}
            </div>

            <Button
              onClick={handleSendMessage}
              className={`shrink-0 ${
                isNoteMode
                  ? "bg-amber-500 hover:bg-amber-600 text-white"
                  : "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
              }`}
              disabled={!selectedAccount?.hasAccess || isSending || isSendingNote}
            >
              {isSending || isSendingNote ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isNoteMode ? (
                <StickyNote className="w-4 h-4" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
