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
