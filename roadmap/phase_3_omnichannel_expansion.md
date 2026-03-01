# Phase 3: Omnichannel Expansion — Email, Web Chat, and Agent Productivity

Priority: MEDIUM-HIGH
Estimated Effort: 15-20 days
Dependency: Phase 1 (service layer, event bus), Phase 2 (frontend functional)

---

## Implementation Status

| Section | Status |
|---------|--------|
| 3.1 Email Channel (Gmail API) | COMPLETED |
| 3.2 Web Chat Widget | Not Started |
| 3.3 Canned Responses | COMPLETED |
| 3.4 Conversation Tags | Not Started |
| 3.5 Internal Notes | COMPLETED |
| 3.6 Message Features | Not Started |

---

## Objective

Expand Excom beyond WhatsApp-only into a true omnichannel platform. Add Email and Web Chat as conversation channels, and build agent productivity tools (canned responses, tags, internal notes) that work across all channels.

---

## 3.1 Email Channel Integration (Gmail API) — COMPLETED

> **Architecture:** Gmail is the storage backend. Email bodies are NEVER stored in Frappe DB. Only metadata pointers (Message-ID, Thread-ID, From, Subject, Date, 150-char snippet) are persisted. Full body fetched on-demand from Gmail API. Deleted emails handled gracefully. Search delegates to Gmail query syntax.

### Implementation Details

#### Backend
- **`Excom Channel Account`** extended with Gmail OAuth2 fields (`email_address`, `email_connected_app`, `email_connected_user`, `email_last_history_id`, sync settings)
- **`gmail_service.py`** — Gmail API wrapper using Frappe Connected App OAuth2 (auto-refresh). Methods: `get_message_metadata()`, `get_message_full()`, `send_email()`, `get_history()`, `search_messages()`
- **`channels/email/inbound.py`** — Polling via Gmail History API (incremental) with fallback to `messages.list` (initial sync). Resolves Omni Identity from sender email, upserts thread with `thread_key=email:{account}:{gmail_thread_id}`
- **`channels/email/outbound.py`** — Sends via Gmail API, creates metadata-only Excom Message stub
- **`api/email.py`** — Endpoints: `get_email_body` (on-demand fetch), `search_emails` (Gmail delegation), `send_email`, `check_gmail_connection`, `manual_sync`
- **Scheduler:** `poll_all_email_accounts` added to `all` scheduler events in hooks.py
- **Patch:** `seed_email_channel.py` seeds the `email` Excom Channel record

#### Frontend
- **`EmailMessageCard.tsx`** — Expandable email card: shows subject + snippet collapsed, loads full body from Gmail on expand, handles deleted emails with notice
- **`EmailCompose.tsx`** — Compose form with To, Cc, Subject, body; supports reply threading
- **`useEmailBody.ts`** — Hook for on-demand body fetching
- Integrated into `ChannelTabsView.tsx` — email messages render as cards, compose button appears for email channels

---

## 3.2 Web Chat / LiveChat Widget

### What Rocket.Chat Has
Full `packages/livechat` widget: embeddable JS widget with composer, file upload, sound alerts, pre-chat forms, multi-language, uiKit extensibility, registration forms, and trigger-based proactive messaging.

### Excom Implementation

#### 3.2.1 Excom Channel — Seed Web Chat Channel
- Seed `Excom Channel`: `name=webchat`, `channel_label=Web Chat`, `is_enabled=1`.
- **Complexity:** Low

#### 3.2.2 Web Chat Widget
Create `excom/public/widget/`:
- Lightweight embeddable chat widget (vanilla JS or Preact for minimal bundle size).
- Features for v1:
  - Text messaging
  - File attachment (image/document)
  - Pre-chat form (name, email, phone — configurable fields)
  - Online/offline status indicator
  - Sound notification on new message
  - Mobile-responsive
- Widget loads via script tag: `<script src="{site}/assets/excom/widget/excom-chat.js"></script>`
- Widget communicates with backend via REST API and Socket.IO for realtime.

- **Complexity:** Very High

#### 3.2.3 Web Chat Backend
Create `excom/excom/channels/webchat/`:
- `api.py`: Whitelisted endpoints for widget (guest-accessible):
  - `create_session(visitor_info)` — create anonymous session, resolve/create Omni Identity
  - `send_visitor_message(session_id, content)` — ingest as inbound message
  - `get_messages(session_id)` — fetch conversation history for widget
- `routing.py`: Route new web chat conversations to available agents.
- Visitor management: create `Excom Visitor Session` record (or use Omni Identity with a temporary session token).

- **Complexity:** Very High

#### 3.2.4 Offline Message Handling
When no agents are available:
- Show offline form in widget (name, email, message).
- Store as pending conversation.
- Notify agents when they come online.
- Inspired by RC's `offlineMessage.ts` and `offlineMessageToChannel.ts`.

- **Complexity:** Medium

---

## 3.3 Canned Responses — COMPLETED

> **Status:** Implemented during Phase 3 work. DocType `Excom Canned Response` created with shortcode, title, content, category, channel, and is_global fields. Backend API `get_canned_responses(search, channel)` added to `chat.py`. Frontend `CannedResponsePopover` component built with `/` trigger, search, category filtering, and keyboard navigation. Integrated into both `ChannelTabsView.tsx` and `MobileChannelView.tsx`.

### What Rocket.Chat Has
`IOmnichannelCannedResponse`: shortcut codes, rich text, scoped to user/department/global, tagged.

### Excom Implementation

#### 3.3.1 Canned Response DocType
Create `Excom Canned Response`:

| Field | Type | Purpose |
|---|---|---|
| `shortcut` | Data (unique) | Trigger code (e.g., `/greeting`) |
| `title` | Data | Human-readable name |
| `content` | Text Editor | Response template body |
| `scope` | Select | User / Department / Global |
| `owner_user` | Link to User | Required when scope = User |
| `department` | Link (future) | Required when scope = Department |
| `tags` | Small Text | Comma-separated tags for filtering |
| `channel` | Link to Excom Channel | Optional: restrict to specific channel |
| `usage_count` | Int | Track popularity for sorting |

- **Complexity:** Medium

#### 3.3.2 Canned Response in Chat UI
- Type `/` in message input to trigger canned response search.
- Show dropdown of matching responses filtered by scope and channel.
- Click to insert response content into message input.
- Support variable substitution: `{{contact_name}}`, `{{company}}`, `{{agent_name}}`.

- **Complexity:** Medium

---

## 3.4 Conversation Tags

### What Rocket.Chat Has
`ILivechatTag`, `ILivechatTagRecord`: named tags with department scoping, applied to conversations.

### Excom Implementation

#### 3.4.1 Excom Tag DocType
Create `Excom Tag`:

| Field | Type | Purpose |
|---|---|---|
| `tag_name` | Data (unique) | Tag label |
| `color` | Color | Visual color for UI badge |
| `department` | Link (future) | Optional department scoping |
| `description` | Small Text | Usage description |

#### 3.4.2 Thread Tags (Child Table)
Add `Excom Thread Tag` child table on `Excom Thread`:
- `tag` (Link to Excom Tag)
- `added_by` (Link to User)
- `added_on` (Datetime)

#### 3.4.3 Tag UI
- Tag chips displayed on thread cards in `ChatThreadList.tsx`.
- Tag management popover in `ChannelTabsView.tsx` header.
- Tag-based filtering in `LeftSidebar.tsx`.

- **Complexity:** Medium

---

## 3.5 Internal Notes — COMPLETED

> **Status:** Implemented during Phase 3 work. `is_internal` (Check) field added to `Excom Message` DocType. Backend API `send_internal_note(thread_id, content)` added to `chat.py`. Frontend Message/Note toggle built into both `ChannelTabsView.tsx` and `MobileChannelView.tsx` with amber styling for notes. Internal notes are never sent to customers via any channel.

### Excom Psychological Handbook Requirement
"Internal notes and customer-facing messages must be impossible to confuse."

### Implementation
- Add `is_internal_note` (Check) field on `Excom Message`.
- Internal notes are visible only to agents, never sent to the customer.
- UI: distinct visual style (yellow/amber background, "Note" badge, italic text).
- Input toggle: switch between "Reply" and "Note" mode in the message composer.
- Notes count separately from customer messages in thread preview.

- **Complexity:** Medium

---

## 3.6 Message Features

### 3.6.1 Message Reactions
- Add `reactions` JSON field on `Excom Message`.
- Agents can react with emoji to messages (internal-only for now).
- Store as `{"emoji": ["user_id1", "user_id2"]}`.
- UI: reaction bar below message bubble, emoji picker on hover/long-press.
- **Complexity:** Medium

### 3.6.2 Message Pinning
- Add `is_pinned` (Check) and `pinned_by` (Link to User) on `Excom Message`.
- Pinned messages section at top of conversation view.
- Pin/unpin action in message context menu.
- **Complexity:** Low

### 3.6.3 Reply/Quote
- `reply_to` field already exists on `Excom Message`.
- UI: show quoted message preview above the reply in message list.
- Long-press or swipe to reply on mobile.
- **Complexity:** Medium

---

## Validation Checklist

- [ ] Emails arrive as Excom Messages and appear in the inbox
- [ ] Outbound emails sent from chat UI are delivered
- [ ] Web chat widget loads on external page and connects to backend
- [x] Canned responses trigger with `/` prefix and insert content
- [ ] Tags can be added/removed from threads and filtered in sidebar
- [x] Internal notes are visually distinct and never sent to customers
- [ ] Message reactions render correctly
- [ ] Pinned messages appear in dedicated section

---

## Handbook Updates Required

- `technical_handbook.md`: Document email adapter, web chat architecture, new DocTypes
- `whatsapp_handbook.md`: No changes (WhatsApp unaffected)
- `psychological_handbook.md`: Note omnichannel vision becoming reality
tomer messages in thread preview.

- **Complexity:** Medium

---

## 3.6 Message Features

### 3.6.1 Message Reactions
- Add `reactions` JSON field on `Excom Message`.
- Agents can react with emoji to messages (internal-only for now).
- Store as `{"emoji": ["user_id1", "user_id2"]}`.
- UI: reaction bar below message bubble, emoji picker on hover/long-press.
- **Complexity:** Medium

### 3.6.2 Message Pinning
- Add `is_pinned` (Check) and `pinned_by` (Link to User) on `Excom Message`.
- Pinned messages section at top of conversation view.
- Pin/unpin action in message context menu.
- **Complexity:** Low

### 3.6.3 Reply/Quote
- `reply_to` field already exists on `Excom Message`.
- UI: show quoted message preview above the reply in message list.
- Long-press or swipe to reply on mobile.
- **Complexity:** Medium

---

## Validation Checklist

- [ ] Emails arrive as Excom Messages and appear in the inbox
- [ ] Outbound emails sent from chat UI are delivered
- [ ] Web chat widget loads on external page and connects to backend
- [x] Canned responses trigger with `/` prefix and insert content
- [ ] Tags can be added/removed from threads and filtered in sidebar
- [x] Internal notes are visually distinct and never sent to customers
- [ ] Message reactions render correctly
- [ ] Pinned messages appear in dedicated section

---

## Handbook Updates Required

- `technical_handbook.md`: Document email adapter, web chat architecture, new DocTypes
- `whatsapp_handbook.md`: No changes (WhatsApp unaffected)
- `psychological_handbook.md`: Note omnichannel vision becoming reality
