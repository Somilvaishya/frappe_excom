import { X, User, Building2, Mail, Phone, FileText, Clock, MessageCircle, Link2, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { useLinkedEntities } from "../../hooks/useLinkedEntities";
import type { UnifiedContact } from "../../types";

interface MobileContactViewProps {
  contact: UnifiedContact;
  onClose: () => void;
}

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

export function MobileContactView({ contact, onClose }: MobileContactViewProps) {
  const { contactInfo } = contact;

  const { linkedEntities, isLoading: linkedLoading } = useLinkedEntities(contact.id);

  return (
    <div className="fixed inset-0 z-40 bg-zinc-950 flex flex-col overflow-hidden">
      <div className="shrink-0 bg-zinc-900 border-b border-zinc-800 p-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Contact Info</h2>
        <Button onClick={onClose} variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4 space-y-6">
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-6 border border-zinc-700">
            <div className="flex flex-col items-center text-center">
              {contact.contactAvatar ? (
                <img src={contact.contactAvatar} alt={contact.contactName} className="w-24 h-24 rounded-full object-cover ring-4 ring-zinc-700 mb-4" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 ring-4 ring-zinc-700 mb-4 flex items-center justify-center text-white text-2xl font-medium">
                  {contact.contactName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
              )}
              <h3 className="text-xl font-semibold text-white mb-1">{contact.contactName}</h3>
              {contactInfo.company && <p className="text-sm text-zinc-400 mb-4">{contactInfo.company}</p>}
              {contactInfo.erpEntity && (
                <Badge className={`${ENTITY_COLORS[contactInfo.erpEntity.type] || "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"} border text-xs`}>
                  <User className="w-3 h-3 mr-1" />
                  {contactInfo.erpEntity.type}: {contactInfo.erpEntity.id}
                </Badge>
              )}
            </div>
          </div>

          {contact.assignedTo && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-white flex items-center gap-2">
                <User className="w-4 h-4 text-green-400" />Assigned Team Member
              </h4>
              <div className="bg-zinc-900/50 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  {contact.assignedTo.avatar ? (
                    <img src={contact.assignedTo.avatar} alt={contact.assignedTo.name} className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center text-white font-medium">{contact.assignedTo.name[0]}</div>
                  )}
                  <div>
                    <p className="font-medium text-white">{contact.assignedTo.name}</p>
                    <p className="text-xs text-zinc-500">Account Manager</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-white">Contact Information</h4>
            <div className="bg-zinc-900/50 rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-500">Email</p>
                  <p className="text-sm text-zinc-300 truncate">{contactInfo.email}</p>
                </div>
              </div>
              <Separator className="bg-zinc-800" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5 text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-500">Phone</p>
                  <p className="text-sm text-zinc-300">{contactInfo.phone}</p>
                </div>
              </div>
              {contactInfo.company && (
                <>
                  <Separator className="bg-zinc-800" />
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-500">Company</p>
                      <p className="text-sm text-zinc-300">{contactInfo.company}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-white flex items-center gap-2">
              <Link2 className="w-4 h-4 text-purple-400" />
              Linked ERP Entities
            </h4>
            {linkedLoading ? (
              <div className="bg-zinc-900/50 rounded-xl p-4 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                <span className="text-xs text-zinc-500">Loading links…</span>
              </div>
            ) : linkedEntities.length === 0 ? (
              <div className="bg-zinc-900/50 rounded-xl p-4 text-center">
                <p className="text-xs text-zinc-500">No linked Lead, Customer, or Contact yet</p>
                <p className="text-[10px] text-zinc-600 mt-1">Link from Omni Identity form</p>
              </div>
            ) : (
              <div className="space-y-2">
                {linkedEntities.map((entity) => (
                  <a
                    key={`${entity.linked_doctype}-${entity.linked_name}`}
                    href={getFormUrl(entity.linked_doctype, entity.linked_name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 active:bg-zinc-800/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <Badge
                        className={`text-[10px] px-2 h-5 border ${
                          ENTITY_COLORS[entity.linked_doctype] || "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                        }`}
                      >
                        {entity.linked_doctype}
                      </Badge>
                      <p className="text-sm font-medium text-white truncate mt-2">{entity.title}</p>
                      <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                        {entity.linked_name}
                        {entity.role && entity.role !== "Unknown" && ` • ${entity.role}`}
                      </p>
                    </div>
                    <ExternalLink className="w-5 h-5 text-zinc-500 shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-white">Conversation Summary</h4>
            <div className="bg-zinc-900/50 rounded-xl p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageCircle className="w-4 h-4 text-blue-400" />
                    <p className="text-xs text-zinc-500">Messages</p>
                  </div>
                  <p className="text-xl font-semibold text-white">{contact.allMessages.length}</p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-orange-400" />
                    <p className="text-xs text-zinc-500">Response</p>
                  </div>
                  <p className="text-xl font-semibold text-white">~5m</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2 pb-6">
            <h4 className="text-sm font-medium text-white mb-3">Quick Actions</h4>
            <Button variant="outline" className="w-full justify-start border-zinc-700 hover:bg-zinc-800 h-12">
              <FileText className="w-5 h-5 mr-3" />View in ERPNext
            </Button>
            <Button variant="outline" className="w-full justify-start border-zinc-700 hover:bg-zinc-800 h-12">
              <Mail className="w-5 h-5 mr-3" />Send Email
            </Button>
            <Button variant="outline" className="w-full justify-start border-zinc-700 hover:bg-zinc-800 h-12">
              <Clock className="w-5 h-5 mr-3" />Schedule Meeting
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
