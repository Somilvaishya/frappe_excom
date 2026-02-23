import {
  Building2,
  Mail,
  Phone,
  DollarSign,
  Clock,
  FileText,
  User,
  MessageCircle,
  Instagram,
  Shield,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Link2,
  Loader2,
} from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { useLinkedEntities } from "../hooks/useLinkedEntities";
import type { Conversation } from "../types";

interface OmniIdentityPanelProps {
  conversation: Conversation;
  onAccountSwitch?: (accountId: string) => void;
}

const CHANNEL_ICONS: Record<string, React.ReactElement> = {
  whatsapp: <MessageCircle className="w-4 h-4 text-green-400" />,
  email: <Mail className="w-4 h-4 text-blue-400" />,
  instagram: <Instagram className="w-4 h-4 text-pink-400" />,
  calls: <Phone className="w-4 h-4 text-purple-400" />,
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  instagram: "Instagram",
  calls: "Phone",
};

const ENTITY_COLORS: Record<string, string> = {
  Lead: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  Customer: "bg-green-500/10 text-green-400 border-green-500/20",
  Supplier: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Contact: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

function getFormUrl(doctype: string, docname: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const slug = doctype.toLowerCase().replace(/\s+/g, "-");
  return `${base}/app/${encodeURIComponent(slug)}/${encodeURIComponent(docname)}`;
}

export function OmniIdentityPanel({
  conversation,
  onAccountSwitch,
}: OmniIdentityPanelProps) {
  const { contactInfo } = conversation;

  const { linkedEntities, isLoading: linkedLoading } = useLinkedEntities(
    conversation.id
  );

  const allAccounts = [
    conversation.activeAccount,
    ...conversation.otherAccounts,
  ];
  const accountsByChannel = allAccounts.reduce((acc, account) => {
    if (!acc[account.channel]) {
      acc[account.channel] = [];
    }
    acc[account.channel].push(account);
    return acc;
  }, {} as Record<string, typeof allAccounts>);

  return (
    <div className="w-80 bg-gradient-to-b from-zinc-900 to-zinc-950 border-l border-zinc-800 flex flex-col h-full shrink-0 overflow-hidden">
      <div className="shrink-0 p-4 border-b border-zinc-800">
        <h2 className="font-semibold text-white">Omni Identity</h2>
        <p className="text-xs text-zinc-400 mt-1">Unified contact profile</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4 space-y-6">
          {/* Contact Card */}
          <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700">
            <div className="flex flex-col items-center text-center">
              {conversation.contactAvatar ? (
                <img
                  src={conversation.contactAvatar}
                  alt={conversation.contactName}
                  className="w-20 h-20 rounded-full object-cover ring-4 ring-zinc-700 mb-3"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 ring-4 ring-zinc-700 mb-3 flex items-center justify-center text-white text-xl font-medium">
                  {conversation.contactName
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
              )}
              <h3 className="font-semibold text-white mb-1">
                {conversation.contactName}
              </h3>
              {contactInfo.company && (
                <p className="text-sm text-zinc-400 mb-3">
                  {contactInfo.company}
                </p>
              )}
              {contactInfo.erpEntity && (
                <Badge
                  className={`${
                    ENTITY_COLORS[contactInfo.erpEntity.type] ||
                    "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                  } border`}
                >
                  <User className="w-3 h-3 mr-1" />
                  {contactInfo.erpEntity.type}: {contactInfo.erpEntity.id}
                </Badge>
              )}
            </div>
          </div>

          {/* Assigned Team Member */}
          {conversation.assignedTo && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-white flex items-center gap-2">
                <User className="w-4 h-4 text-green-400" />
                Assigned Team Member
              </h4>
              <div className="bg-zinc-800/30 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  {conversation.assignedTo.avatar ? (
                    <img
                      src={conversation.assignedTo.avatar}
                      alt={conversation.assignedTo.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-white text-sm font-medium">
                      {conversation.assignedTo.name[0]}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-white">
                      {conversation.assignedTo.name}
                    </p>
                    <p className="text-xs text-zinc-500">Account Manager</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Active Channels & Accounts */}
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium text-white flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-blue-400" />
                Active Channels & Accounts
              </h4>
              <p className="text-[10px] text-zinc-500 mt-1 ml-6">
                Click on any account with access to switch conversation threads
              </p>
            </div>
            <div className="space-y-2">
              {Object.entries(accountsByChannel).map(([channel, accounts]) => (
                <div key={channel} className="bg-zinc-800/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    {CHANNEL_ICONS[channel]}
                    <span className="text-sm font-medium text-white">
                      {CHANNEL_LABELS[channel] || channel}
                    </span>
                    <Badge className="ml-auto text-[9px] px-1.5 h-4 bg-blue-500/20 text-blue-300 border-0">
                      {accounts.length} account
                      {accounts.length > 1 ? "s" : ""}
                    </Badge>
                  </div>
                  <div className="space-y-1.5 pl-6">
                    {accounts.map((account) => {
                      const isActiveAccount =
                        account.id === conversation.activeAccount.id;
                      const canSwitch = account.hasAccess && !isActiveAccount;
                      return (
                        <button
                          key={account.id}
                          onClick={() =>
                            canSwitch && onAccountSwitch?.(account.id)
                          }
                          disabled={!canSwitch}
                          className={`group w-full flex items-center justify-between text-xs p-2 rounded transition-all ${
                            isActiveAccount
                              ? "bg-blue-500/10 border border-blue-500/30"
                              : canSwitch
                              ? "hover:bg-zinc-700/50 cursor-pointer"
                              : "opacity-50 cursor-not-allowed"
                          }`}
                        >
                          <div className="flex-1 min-w-0 text-left flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-zinc-300 font-medium truncate">
                                  {account.name}
                                </p>
                                {isActiveAccount && (
                                  <Badge className="text-[8px] px-1 h-3.5 bg-blue-500 text-white border-0">
                                    ACTIVE
                                  </Badge>
                                )}
                              </div>
                              <p className="text-zinc-500 text-[10px] truncate">
                                {account.identifier}
                              </p>
                            </div>
                            {canSwitch && (
                              <ArrowRight className="w-3.5 h-3.5 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            {account.hasAccess ? (
                              <Badge className="text-[9px] px-1.5 h-4 bg-green-500/20 text-green-300 border-0">
                                <Shield className="w-2.5 h-2.5 mr-0.5" />
                                Access
                              </Badge>
                            ) : (
                              <Badge className="text-[9px] px-1.5 h-4 bg-orange-500/20 text-orange-300 border-0">
                                <ShieldAlert className="w-2.5 h-2.5 mr-0.5" />
                                No Access
                              </Badge>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-400" />
              Contact Information
            </h4>
            <div className="bg-zinc-800/30 rounded-lg p-3 space-y-3">
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-500">Email</p>
                  <p className="text-sm text-zinc-300 truncate">
                    {contactInfo.email}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-zinc-500">Phone</p>
                  <p className="text-sm text-zinc-300">{contactInfo.phone}</p>
                </div>
              </div>
              {contactInfo.company && (
                <div className="flex items-start gap-3">
                  <Building2 className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-zinc-500">Company</p>
                    <p className="text-sm text-zinc-300">
                      {contactInfo.company}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Linked ERP Entities */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-white flex items-center gap-2">
              <Link2 className="w-4 h-4 text-purple-400" />
              Linked ERP Entities
            </h4>
            {linkedLoading ? (
              <div className="bg-zinc-800/30 rounded-lg p-4 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                <span className="text-xs text-zinc-500">Loading links…</span>
              </div>
            ) : linkedEntities.length === 0 ? (
              <div className="bg-zinc-800/30 rounded-lg p-4 text-center">
                <p className="text-xs text-zinc-500">
                  No linked Lead, Customer, or Contact yet
                </p>
                <p className="text-[10px] text-zinc-600 mt-1">
                  Link from Omni Identity form
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {linkedEntities.map((entity) => (
                  <a
                    key={`${entity.linked_doctype}-${entity.linked_name}`}
                    href={getFormUrl(entity.linked_doctype, entity.linked_name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 p-3 rounded-lg bg-zinc-800/30 border border-zinc-700 hover:border-blue-500/40 hover:bg-zinc-800/50 transition-all"
                  >
                    <div
                      className={`flex-1 min-w-0 ${
                        ENTITY_COLORS[entity.linked_doctype]
                          ? ""
                          : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                      }`}
                    >
                      <Badge
                        className={`text-[10px] px-2 h-5 border ${
                          ENTITY_COLORS[entity.linked_doctype] ||
                          "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                        }`}
                      >
                        {entity.linked_doctype}
                      </Badge>
                      <p className="text-sm font-medium text-white truncate mt-1.5">
                        {entity.title}
                      </p>
                      <p className="text-[10px] text-zinc-500 truncate">
                        {entity.linked_name}
                        {entity.role && entity.role !== "Unknown" && (
                          <span className="ml-1">• {entity.role}</span>
                        )}
                      </p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-blue-400 shrink-0 transition-colors" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Conversation Summary */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-400" />
              Conversation Summary
            </h4>
            <div className="bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 rounded-lg p-4 border border-zinc-700">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-400">Total Messages</span>
                  <span className="font-medium text-white">
                    {conversation.messages.length}
                  </span>
                </div>
                <Separator className="bg-zinc-700" />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-400">Response Time</span>
                  <span className="font-medium text-white">~5 min</span>
                </div>
                <Separator className="bg-zinc-700" />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-400">Channel</span>
                  <Badge
                    variant="outline"
                    className="border-zinc-600 text-zinc-300"
                  >
                    {conversation.channel}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-white mb-3">
              Quick Actions
            </h4>
            <Button
              variant="outline"
              className="w-full justify-start border-zinc-700 hover:bg-zinc-800"
            >
              <FileText className="w-4 h-4 mr-2" />
              View in ERPNext
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-zinc-700 hover:bg-zinc-800"
            >
              <Mail className="w-4 h-4 mr-2" />
              Send Email
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-zinc-700 hover:bg-zinc-800"
            >
              <Clock className="w-4 h-4 mr-2" />
              Schedule Meeting
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
