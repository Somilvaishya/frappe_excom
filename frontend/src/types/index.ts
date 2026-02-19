export interface WhatsAppProfile {
  name: string;
  profile_name: string;
  number: string;
  contact?: string;
  title?: string;
  whatsapp_account?: string;
  last_message?: string;
  last_message_time?: string;
  unread_count?: number;
}

export interface WhatsAppMessage {
  name: string;
  type: "Outgoing" | "Incoming";
  status: string;
  to: string;
  from: string;
  message: string;
  content_type: string;
  message_type: string;
  creation: string;
  is_reply?: boolean;
  reply_to_message_id?: string;
  media_image?: string;
  media_file?: string;
}
