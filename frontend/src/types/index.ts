export interface ExcomThread {
  name: string;
  display_name: string;
  primary_phone: string;
  last_message_at: string;
  last_message_preview: string;
  last_message_direction: "Inbound" | "Outbound";
  unread_count: number;
  status: string;
  assigned_to: string;
  omni_identity: string;
  channel: string;
  account: string;
}

export interface ExcomMessage {
  name: string;
  direction: "Inbound" | "Outbound";
  message_type: string;
  content_text: string;
  media_file: string;
  delivery_status: string;
  creation: string;
  provider_message_id: string;
  reply_to: string;
  created_by_user: string;
  sender_name: string;
}

export interface Account {
  id: string;
  name: string;
  identifier: string;
  channel: string;
  isActive: boolean;
  hasAccess: boolean;
}

export interface Message {
  id: string;
  content: string;
  timestamp: Date;
  sender: "user" | "contact" | "ai";
  status?: "sent" | "delivered" | "read";
  type?: "text" | "image" | "document" | "audio";
  mediaUrl?: string;
  channel?: string;
  sentBy?: {
    name: string;
    avatar: string;
  };
  accountUsed?: {
    id: string;
    name: string;
    identifier: string;
    channel?: string;
  };
}

export interface ContactInfo {
  email: string;
  phone: string;
  company?: string;
  erpEntity?: {
    type: string;
    id: string;
    value?: string;
  };
}

export interface UnifiedContact {
  id: string;
  contactName: string;
  contactAvatar: string;
  contactInfo: ContactInfo;
  status: "online" | "offline" | "away";
  lastMessage: string;
  timestamp: Date;
  totalUnreadCount: number;
  aiStatus?: "active" | "human-takeover";
  assignedTo?: {
    name: string;
    avatar: string;
  };
  allAccounts: Account[];
  activeAccountId: string;
  allMessages: Message[];
  channels: string[];
}

export interface Conversation {
  id: string;
  contactName: string;
  contactAvatar: string;
  channel: string;
  lastMessage: string;
  timestamp: Date;
  unreadCount: number;
  status: "online" | "offline" | "away";
  aiStatus?: "active" | "human-takeover";
  assignedTo?: {
    name: string;
    avatar: string;
  };
  contactInfo: ContactInfo;
  activeAccount: Account;
  otherAccounts: Account[];
  messages: Message[];
  hiddenMessageCount?: number;
}
