# Excom Technical Handbook

## Purpose

`excom` is a Frappe app for a unified external communication ecosystem.
This handbook captures what is being built, why, and how technical decisions are made.

Companion deep-dive handbook:

- `whatsapp_handbook.md` for WhatsApp-specific API and implementation requirements.

## Current Stage

Stage: Foundation implementation in progress.

Core WhatsApp communication flows are now implemented and being hardened for delayed execution and operational observability.

## Implementation Update (2026-02-20)

First backend foundation has been implemented:

- Added `Excom Channel` DocType as a system-managed channel registry.
- Locked UI edits by combining:
  - read-only DocType permissions for `System Manager` (read/report/export/print only)
  - controller-level write guards that allow writes only in install/migrate/patch contexts
- Added a post-model patch to seed default channel record:
  - `name = whatsapp`
  - `channel_label = WhatsApp`
  - `is_enabled = 1`

Why this change:

- Establish a stable channel source-of-truth early.
- Support the requirement that one channel can map to multiple provider accounts (handled at integration account DocTypes, not in channel master key fields).
- Prevent accidental UI drift in foundational configuration records.

Impacted modules:

- `excom/excom/doctype/excom_channel/`
- `excom/patches/v1_0/create_default_excom_channel.py`
- `excom/patches.txt`

Migration implications:

- Requires `bench --site <site> migrate` (or app install) to create the DocType table and seed `whatsapp`.
- Existing data is not modified because this is an additive change.

## Implementation Update (2026-02-20, WhatsApp Delay + Log Queue)

WhatsApp notification execution now supports delayed dispatch using `WhatsApp Notification Log` as both queue and audit table.

What changed:

- `WhatsApp Notification` now supports:
  - `enable_delay`
  - `delay_value`
  - `delay_unit` (`Minutes/Hours/Days`)
  - `print_format` override when `attach_document_print` is enabled
- Delayed DocType-event notifications are queued as `Pending` rows in `WhatsApp Notification Log` instead of sending immediately.
- Added lifecycle fields in `WhatsApp Notification Log`:
  - `notification`, `status`, `scheduled_for`, `pending_since`, `pending_for_seconds`
  - `processed_on`, `reference_doctype`, `reference_name`, `to_number`, `reason`
  - `request_payload`, `response_payload`, `meta_data`
- Added scheduler worker to process due pending logs and update pending duration.
- Added cancellation-safe checks before delayed send:
  - cancel if source document is deleted
  - cancel if source document is cancelled (`docstatus = 2`)
  - cancel if notification config is missing/disabled

Why it changed:

- Replicates n8n-style workflow psychology (quick trigger, delayed execution, state re-check at send time) in a Frappe-native way.
- Makes delayed operations auditable and operable from one table.
- Enables dynamic print format behavior by `reference_doctype` with optional per-notification override.

Impacted modules:

- `excom/excom/doctype/whatsapp_notification/whatsapp_notification.json`
- `excom/excom/doctype/whatsapp_notification/whatsapp_notification.js`
- `excom/excom/doctype/whatsapp_notification/whatsapp_notification.py`
- `excom/excom/doctype/whatsapp_notification_log/whatsapp_notification_log.json`
- `excom/excom/doctype/whatsapp_notification_log/whatsapp_notification_log.py`
- `excom/excom/utils/__init__.py`
- `excom/hooks.py`

Migration implications:

- Requires `bench --site <site> migrate` to apply new DocType fields.
- Existing log rows remain valid; new fields are additive.
- Scheduler now includes pending-log processing for delayed WhatsApp notifications.

## Implementation Update (2026-02-24, Delayed Notification Queue Wiring)

`send_template_message` previously did not check `enable_delay`; all DocType-event notifications were sent immediately. The scheduler processor existed but no code path created Pending logs with `scheduled_for`.

What changed:

- `send_template_message` now checks `self.enable_delay` and `notification_type == "DocType Event"`.
- When both are true, `_queue_delayed_notification()` creates a `WhatsApp Notification Log` with `status="Pending"`, `scheduled_for`, `reference_doctype`, `reference_name`, `to_number`, and `notification`.
- The scheduler processor (`process_pending_whatsapp_notification_logs`) picks up due logs and calls `send_template_message` with `force_send=True`, which bypasses the delay branch and sends immediately.
- Added `notification_log_name` and `force_send` parameters for processor compatibility.

Impacted modules:

- `excom/excom/doctype/whatsapp_notification/whatsapp_notification.py`

Migration implications:

- None. Behaviour is additive; notifications without `enable_delay` unchanged.

## Sources Studied

- Chatwoot (`chatwoot/chatwoot`): mature omnichannel support inbox, automation, assignments, reports.
- Rocket.Chat (`RocketChat/Rocket.Chat`): secure team communication platform with strong channel model and extensibility.
- Raven (`The-Commit-Company/raven`): Frappe-native messaging product patterns and integration-first UX.
- Mint (`The-Commit-Company/mint`): Frappe + React architecture style, focused domain workflows, and clean app boundaries.

## Product Scope for Excom

Excom will unify external channels into one operator workspace:

- WhatsApp
- Email
- Web chat/widget
- Social connectors (later phase)
- SMS/voice connectors (later phase)

Core outcomes:

- One customer identity across channels.
- One conversation timeline across channels.
- One rule engine for routing, automation, and SLAs.
- One audit-ready event log for compliance and analytics.

## Reference Capability Matrix

### From Chatwoot

- Omnichannel inbox and conversation assignment.
- Labels, canned responses, notes, teams, automation rules.
- Reporting and performance metrics.
- Help center and self-serve support surfaces.

### From Rocket.Chat

- Channel abstractions with access control.
- Real-time collaboration patterns.
- Security-first posture and enterprise readiness.
- Extensibility model for integrations and apps.

### From Raven and Mint (Architecture Direction)

- Frappe-native backend and permission system.
- React frontend with clear module boundaries.
- Shared utility layer and reusable hooks.
- Domain-first workflows rather than generic abstractions.

## Target Architecture (v1 Blueprint)

### 1) Channel Connectors Layer

Responsibility:

- Normalize inbound/outbound payloads from providers.
- Handle provider auth, retries, delivery receipts, webhook verification.

Notes:

- Provider-specific logic must stay in adapter modules.
- Exposed to domain via normalized events only.

### 2) Conversation Core

Responsibility:

- Contact resolution and identity merge.
- Conversation thread lifecycle.
- Message persistence and timeline ordering.

Notes:

- This is the source of truth for conversation state.

### 3) Workflow and Automation

Responsibility:

- Assignment and queue routing.
- Rule evaluation (conditions, priorities, actions).
- SLA timers and escalation events.

Notes:

- Deterministic and auditable outcomes are mandatory.

### 4) Agent Workspace

Responsibility:

- Unified inbox, thread view, composer, internal notes.
- AI assist surface (later phase, optional).
- Team workload and handoff UX.

Notes:

- Keep interaction latency low; support optimistic UI for sending.

### 5) Governance and Analytics

Responsibility:

- Immutable event trail.
- Performance dashboards and operational metrics.
- Retention policies and export/compliance workflows.

## Data Model Strategy: Reuse First, Add Last

Excom will minimize new DocTypes and reuse existing ones wherever possible.

### Existing DocTypes (Migrated to Excom)

All WhatsApp DocTypes have been migrated from the legacy WhatsApp app into Excom:

- `WhatsApp Account`
- `WhatsApp Message`
- `WhatsApp Templates`
- `WhatsApp Notification`
- `WhatsApp Flow`
- `WhatsApp Profiles`
- `WhatsApp Notification Log`
- `WhatsApp Recipient List`
- `WhatsApp Recipient`
- `Bulk WhatsApp Message`
- `WhatsApp Button`
- `WhatsApp Flow Field`
- `WhatsApp Flow Screen`
- `WhatsApp Message Fields`
- `WhatsApp Settings`

From `whatsapp_chat`:

- `WhatsApp Contact`

From WhatsApp Chatbot app:

- `WhatsApp Chatbot`
- `WhatsApp Keyword Reply`
- `WhatsApp Chatbot Flow`
- `WhatsApp Chatbot Session`
- `WhatsApp Agent Transfer`

From `frappe` / `erpnext` / `crm` (installed stack dependent):

- `Contact`
- `Lead`
- `Opportunity`
- `Customer` (when lifecycle reaches customer state)

From `helpdesk` (installed stack dependent):

- Ticket DocTypes (for example `HD Ticket`) and linked timeline/comment artifacts

### Compatibility with Frappe CRM and Helpdesk

Excom will treat CRM and Helpdesk as first-class downstream systems, not optional add-ons.

CRM compatibility baseline:

- Resolve external identities into a single `Contact` first.
- Link conversations to `Lead`/`Opportunity` when sales context exists.
- Add routing hooks for sales ownership and stage-aware prioritization.

Helpdesk compatibility baseline:

- Allow conversation-to-ticket linking without message duplication.
- Push key events (first response, resolution, reopen, SLA breach) to ticket timeline.
- Support ticket-first and conversation-first workflows.

Shared compatibility rules:

- Use references/links between records instead of copying long text payloads.
- Keep permissions aligned with CRM/Helpdesk ownership models.
- Preserve bidirectional traceability (`Conversation <-> Contact <-> Lead/Deal <-> Ticket`).

### Contact Profile Strategy (AI Behavioral Summary)

Each resolved `Contact` will have a Contact Profile for future decisioning.

Reuse-first storage approach:

- Store profile fields on `Contact` via custom fields (no separate profile DocType in phase 1).
- Recommended fields:
  - `excom_profile_summary` (Long Text)
  - `excom_profile_tags` (Data or JSON text)
  - `excom_profile_sentiment` (Select)
  - `excom_profile_last_updated_on` (Datetime)
  - `excom_profile_confidence` (Float)

Profile generation approach:

- Generate summary asynchronously from conversation history and CRM/Helpdesk interactions.
- Keep profile editable by humans; AI is assistive, not authoritative.
- Track regeneration time and confidence to avoid stale assumptions.

### New DocTypes Policy

- Phase 1 target: zero new core message/contact/channel DocTypes.
- New DocTypes are allowed only when cross-channel requirements cannot be represented safely using existing models.
- If new DocTypes are needed, add the minimum possible and keep them integration-oriented.

### Minimal New DocTypes (If Strictly Required)

1. `Excom Conversation Link` (optional)
   - Purpose: map multiple provider thread/message IDs into one unified operator thread without duplicating message bodies.
2. `Excom Routing Rule` (optional)
   - Purpose: channel-agnostic routing and escalation orchestration when existing notification/chatbot rules are insufficient.

No other new DocTypes should be introduced until these are proven insufficient.

## Suggested Module Boundaries

- `excom/connectors/` provider adapters and webhook handlers.
- `excom/domain/` orchestration services that wrap existing DocTypes.
- `excom/workflows/` routing, SLAs, and automation logic.
- `excom/api/` whitelisted endpoints and DTO validation.
- `excom/analytics/` reporting on top of existing message/session tables.
- `excom/compat/` CRM and Helpdesk mapping services and sync contracts.
- `excom/frontend/` operator UI app.

## Engineering Constraints

- Keep Doctype controllers minimal; business logic must live in service modules.
- Prefer `frappe.db.get_value`, `frappe.get_doc`, and `frappe.get_all` over raw SQL unless profiling proves a need.
- Use asynchronous jobs for connector retries and heavy processing.
- Preserve idempotency in webhook and message ingest paths.
- WhatsApp functionality has been migrated from the legacy WhatsApp app into Excom. All WhatsApp DocTypes now belong to the Excom module.
- AI-generated contact profiles must be deterministic per input window and recomputed through background jobs.

## Security and Compliance Baseline

- Verify all webhooks and signatures before processing.
- Encrypt sensitive connector credentials at rest.
- Record every message state transition as an event.
- Ensure role-based access for conversations and channels.

## Performance Baseline

- Inbound webhook handling target: fast accept, async processing.
- Message send path: queue-based with provider retry policy.
- Timeline fetch: indexed by conversation and message timestamp.

## Migration Implications

Current change set includes schema and runtime behavior updates.

- New `WhatsApp Notification` fields for delay and print-format override.
- New `WhatsApp Notification Log` fields for queue lifecycle and observability.
- Scheduler now processes pending delayed logs and updates elapsed pending time.
- Existing immediate notification flow remains backward-compatible when delay is disabled.

## Build Phases (Recommended)

1. Foundation (reuse-first): service layer over existing WhatsApp/chat/chatbot DocTypes.
2. CRM/Helpdesk compatibility layer: `Contact` resolution, `Lead/Opportunity` linking, ticket linking.
3. Unified inbox MVP: read models and APIs without introducing new message/contact DocTypes.
4. Routing and SLA: first reuse existing notification/chatbot rules, then add `Excom Routing Rule` only if gaps remain.
5. Cross-channel stitching: introduce `Excom Conversation Link` only if unified timeline cannot be achieved via existing references.
6. AI Contact Profile: enrich each `Contact` with summary fields and confidence-scored behavior tags.
7. Analytics and governance: build dashboards from existing message and event sources; add storage only if required.

## Removed Logic

- Removed proposal of many net-new Excom DocTypes (`Excom Channel`, `Excom Contact`, `Excom Message`, `Excom SLA Event`, etc.).
- Reason: avoid schema duplication and leverage mature existing models from installed WhatsApp ecosystem apps.
- Historical relevance: if future channels (email/web/social) expose unavoidable modeling gaps, revisit with strict ADR and migration notes.
- Added requirement that each `Contact` carries an AI-generated profile summary using `Contact` extension fields instead of a new profile DocType.

## Implementation Update (2026-02-23, Omni Identity)

### What is Omni Identity

A universal person anchor that represents one real-world person across all communication channels and ERP entities. It is NOT a replacement for Contact, Customer, or Lead. Those remain first-class ERP entities. Omni Identity sits above them as a cross-channel resolution layer.

### DocTypes Added

1. **Omni Identity** — main record
   - `display_name` — human-readable label
   - `primary_phone`, `primary_email`, `primary_whatsapp` — contact coordinates
   - `normalized_phone`, `normalized_email` — hidden, system-computed for dedup
   - `hash_fingerprint` — SHA-256 of sorted normalized identifiers (unique, hidden)
   - `status` — Active / Merged / Archived
   - `channels` — Table of Omni Identity Channel (channel-specific IDs)
   - `linked_entities` — Table of Omni Identity Link (Contact, Lead, Customer, etc.)
   - `is_master`, `merged_into`, `merge_group_id` — merge/dedup system
   - `ai_profile_summary` — AI-generated behavioral summary

2. **Omni Identity Channel** (child table)
   - `channel_type` — Link to Excom Channel (WhatsApp, Instagram, etc.)
   - `channel_user_id` — provider-specific user ID (phone number, handle, etc.)
   - `verified`, `last_seen`

3. **Omni Identity Link** (child table)
   - `linked_doctype` — Link to DocType (Lead, Contact, Customer, Supplier, etc.)
   - `linked_name` — Dynamic Link to the actual record
   - `role` — Decision Maker / Billing / Technical / Primary Contact / Influencer / Unknown

### Identity Resolution Flow (v1)

When a new message arrives:

1. Normalize phone/email
2. Search Omni Identity:
   - Match `normalized_phone`
   - OR match `channel_user_id` in Omni Identity Channel
   - OR match `normalized_email`
3. If found → attach channel, update last_seen
4. If not → create new Omni Identity with channel entry
5. Then: link or create Contact/Lead as needed

API: `excom.excom.doctype.omni_identity.omni_identity.resolve_identity`
Merge: `excom.excom.doctype.omni_identity.omni_identity.merge_identities`

### Merge Mechanics

- Source identity's channels and links are copied to the master
- Source status becomes "Merged", `merged_into` points to master
- Both records share the same `merge_group_id`
- Source `is_master` is set to 0
- All future lookups skip Merged records

### Design Constraints

- Omni Identity does not store messages (Excom Message does)
- Omni Identity does not replace Contact (it links to Contact)
- Normalized fields are hidden from UI, computed on validate
- `hash_fingerprint` is unique to prevent accidental duplicate creation
- Track changes enabled for full audit trail
- Omni Identity Alias child table added for alternate phones/emails; searched during resolution as fallback


## Implementation Update (2026-02-23, Excom Thread and Message)

### What Changed

Introduced the conversation and message layer that replaces WhatsApp Message and WhatsApp Profiles with channel-agnostic doctypes.

### New DocTypes

**Excom Thread** — conversation anchor, one per identity x channel x account. Fields include omni_identity, channel, account (Dynamic Link), thread_key (unique), status (Open/Pending/Closed), assigned_to, priority, unread_count, last_message_at/last_inbound_at/last_outbound_at, last_message_preview, last_message_direction, display_name, primary_phone (denormalized). Indexed on thread_key, last_message_at, and (omni_identity, channel, account).

**Excom Message** — immutable event log replacing WhatsApp Message. Fields include thread, omni_identity, channel, account (Dynamic Link), direction (Inbound/Outbound), message_type, delivery_status, content_text, content_json, media_file, provider_message_id (idempotency key), provider_timestamp, reply_to, created_by_user, template, failure_reason, reference_doctype/reference_name. Indexed on provider_message_id and (thread, creation). Track changes disabled (immutable log).

**Omni Identity Alias** — child table on Omni Identity for alternate numbers, emails, country codes. Fields: alias_type, alias_value_raw, alias_value_normalized, verified, source, last_seen.

### Service Layer

File: `excom/excom/services/thread_service.py`

- `upsert_thread()` — find or create thread by thread_key
- `ingest_inbound_message()` — full pipeline: resolve identity, upsert thread, check idempotency, insert message, update thread counters
- `send_outbound_message()` — call provider API, insert message, update thread timestamps
- `update_delivery_status()` — update delivery_status on Excom Message by provider_message_id

### Inbox Correctness Rule (Non-Negotiable)

Inbox reads ONLY from `tabExcom Thread` ordered by `last_message_at DESC`. Zero joins, zero subqueries, O(1) per row. Messages loaded only when a thread is opened, queried by `(thread, creation)` index.

### Webhook and Chat API

Webhook handler routes all inbound messages through `ingest_inbound_message()`. Status callbacks update `delivery_status` on Excom Message. Chat API queries Excom Thread for sidebar and Excom Message for message list. Send operations go through `send_outbound_message()`.

### Migration

Patch `migrate_whatsapp_to_excom_messages` converts existing WhatsApp Profiles and Messages into Omni Identity + Excom Thread + Excom Message records. Original WhatsApp Message table preserved as archive.

## Implementation Update (2026-02-24, Frontend UI Overhaul)

### What Changed

Complete replacement of the WhatsApp-style 2-panel chat UI with a modern 4-panel omnichannel communication dashboard adapted from Figma designs.

### Architecture Change: 2-Panel to 4-Panel Layout

Old layout (removed):
- `ChatSidebar` + `ChatWindow` (WhatsApp clone)
- Components: `ChatSidebar.tsx`, `ChatWindow.tsx`, `MessageBubble.tsx`, `ContactItem.tsx`, `Avatar.tsx`, `EmptyState.tsx`
- Page: `ChatLayout.tsx`
- Theme: WhatsApp green dark (`chat-*` color palette)
- Icons: `react-icons`
- Dates: `dayjs`

New layout (implemented):
- `LeftSidebar` + `ChatThreadList` + `ChannelTabsView` + `OmniIdentityPanel` + `AIAssistantDrawer`
- Full mobile experience: `MobileApp`, `MobileConversationList`, `MobileChannelView`, `MobileContactView`, `MobileAIDrawer`, `CallScreen`
- Theme: zinc/blue-purple dark gradient
- UI library: shadcn/ui (Radix primitives)
- Icons: `lucide-react`
- Dates: `date-fns`

### New Component Library (shadcn/ui)

Created `frontend/src/components/ui/` with reusable primitives:
- `button.tsx` (CVA variant system)
- `input.tsx`
- `badge.tsx`
- `scroll-area.tsx` (Radix)
- `tabs.tsx` (Radix)
- `separator.tsx` (Radix)
- `dropdown-menu.tsx` (Radix)
- `tooltip.tsx` (Radix)
- `utils.ts` (`cn()` helper using `clsx` + `tailwind-merge`)

### New Desktop Components

- **LeftSidebar**: Channel filter dropdown, search input, conversation statistics, branding
- **ChatThreadList**: Conversation cards with avatar, channel icons, unread badges, ERP entity tags, multi-channel indicators
- **ChannelTabsView**: Channel tabs header, account selector, message list with delivery status, AI status badge, message input with attachments
- **OmniIdentityPanel**: Contact card, active channels and accounts with access badges, contact information, ERP integration details, quick actions
- **AIAssistantDrawer**: Suggested replies, conversation summary, recommended actions with priority, quick insights

### New Mobile Components

- **MobileApp**: Root mobile component with view stack (list, conversation, call, contact) and bottom tab navigation
- **MobileConversationList**: Thread list with search, channel icons, AI/human status badges
- **MobileChannelView**: Conversation view with channel tabs, account selector, message list, input area
- **MobileContactView**: Full-screen contact info with ERP integration details
- **MobileAIDrawer**: AI suggestions overlay for mobile
- **CallScreen**: Voice/video call UI with controls and status

### Data Model Adaptation

New TypeScript types added alongside existing ones:
- `UnifiedContact` — aggregates threads by omni_identity into a single contact with all channels, accounts, and messages
- `Account` — represents a channel account with access control
- `Message` — enhanced message type with sender info, delivery status, media support
- `Conversation` — denormalized view for the OmniIdentityPanel

### Hook Transformation

- `useContacts.ts` (`useThreads`) — now returns both raw `ExcomThread[]` and transformed `UnifiedContact[]` by grouping threads by `omni_identity`
- `useMessages.ts` — now returns both raw `ExcomMessage[]` and transformed `Message[]` with mapped delivery status and message types

### Dependencies Added

- `lucide-react` (replacing `react-icons`)
- `date-fns` (replacing `dayjs`)
- `class-variance-authority` + `tailwind-merge` + `clsx` (shadcn/ui variant system)
- `@radix-ui/react-scroll-area`, `@radix-ui/react-tabs`, `@radix-ui/react-separator`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-dialog`, `@radix-ui/react-slot`, `@radix-ui/react-tooltip`

### Deleted Files

- `src/components/ChatSidebar.tsx`
- `src/components/ChatWindow.tsx`
- `src/components/MessageBubble.tsx`
- `src/components/ContactItem.tsx`
- `src/components/Avatar.tsx`
- `src/components/EmptyState.tsx`
- `src/pages/ChatLayout.tsx`

### Migration Implications

- Frontend-only change; no backend schema modifications
- Old `react-icons` and `dayjs` packages can be removed from `package.json` in a follow-up cleanup
- Tailwind config completely replaced; any custom `chat-*` color references in other files will need updating
- `App.tsx` no longer uses React Router for page routing; the 4-panel layout is rendered directly with state-driven navigation

## Implementation Update (2026-02-24, Phase 0 — Critical Fixes and Identity Hardening)

### What Changed

Six items implemented as Phase 0 of the Excom roadmap. All are in `roadmap/phase_0_critical_fixes.md`.

**0.1 — Bulk WhatsApp Message status bug fixed**
- File: `excom/excom/doctype/bulk_whatsapp_message/bulk_whatsapp_message.py`
- `self.status == "In Progress"` (comparison) corrected to `self.db_set("status", "In Progress")` (assignment) in `create_single_message()`.

**0.2 & 0.3 — Scheduler and doc_events activated in hooks.py**
- `scheduler_events` now calls all WhatsApp notification trigger functions: hourly, daily, weekly, monthly, and their long variants. The `process_pending_whatsapp_notification_logs` and `trigger_whatsapp_notifications_all` run on every `all` tick.
- `doc_events` now wires `run_server_script_for_doc_event` to all six standard document lifecycle events on every DocType. WhatsApp Notification automation for DocType events is now functional.

**0.4 — Webhook async processing**
- File: `excom/excom/utils/webhook.py`
- `post()` now logs the raw payload synchronously (audit), commits, then enqueues `_process_webhook_payload` as a background job via `frappe.enqueue`. Returns `Response("", 200)` immediately.
- All message parsing, media download, identity resolution, and thread ingestion moved to `_process_webhook_payload(data_str)`.
- In test mode (`frappe.flags.in_test`), the job runs inline (synchronous).

**0.5 — Idempotency guard confirmed**
- `thread_service.ingest_inbound_message()` already checks `frappe.db.exists("Excom Message", {"provider_message_id": ...})` before any write. This continues to work correctly inside the background job.

**0.6 — Identity resolution hardened (8-step chain)**
- File: `excom/excom/doctype/omni_identity/omni_identity.py`
- Added Step 5: email alias lookup in `Omni Identity Alias` (was missing).
- Added Step 6: ERPNext reverse lookup via `Contact Phone` — if a Contact with this phone is already linked to an Omni Identity, bridge to that identity.
- Added Step 7: ERPNext reverse lookup via `Contact Email` — same bridge via email.
- Added auto-alias registration: when a found identity has a different primary phone/email than the inbound signal, auto-append the new value as an alias (source=Auto) so future lookups resolve directly via step 2/5.
- Added `_find_potential_duplicate()` helper: checks exact display_name match and last-10-digit phone match. When triggered, sets `needs_review=1` and `potential_duplicate_of` on the new record for supervisor review.
- New schema fields on `Omni Identity`: `needs_review` (Check, hidden), `potential_duplicate_of` (Link to Omni Identity, hidden).
- Added `Auto` as a source option on `Omni Identity Alias`.

### Complete 8-Step Resolution Chain

```
1. normalized_phone on Omni Identity
2. alias phone/WhatsApp in Omni Identity Alias
3. channel_user_id in Omni Identity Channel
4. normalized_email on Omni Identity
5. alias email in Omni Identity Alias              [NEW]
6. Contact Phone -> Omni Identity Link bridge      [NEW]
7. Contact Email -> Omni Identity Link bridge      [NEW]
8. Create new identity; flag potential duplicates  [NEW]
```

### Why This Matters

The ERPNext reverse lookup (steps 6-7) is Excom's structural advantage over Rocket.Chat, Chatwoot, and every standalone messaging platform. A Contact record in ERPNext typically has both phone and email, acting as the cross-channel bridge. A person who messages via WhatsApp (phone match) and later sends an email (no phone match) will be resolved to the same Omni Identity as long as a Contact with both identifiers is already linked.

### Impacted Modules

- `excom/excom/doctype/bulk_whatsapp_message/bulk_whatsapp_message.py` — status assignment fix
- `excom/hooks.py` — scheduler_events and doc_events activated
- `excom/excom/utils/webhook.py` — async post(), `_process_webhook_payload` extracted, top-level `datetime` import
- `excom/excom/doctype/omni_identity/omni_identity.py` — hardened `resolve_identity`, new `_find_potential_duplicate` helper
- `excom/excom/doctype/omni_identity/omni_identity.json` — new `needs_review` and `potential_duplicate_of` fields
- `excom/excom/doctype/omni_identity_alias/omni_identity_alias.json` — added `Auto` source option

### Migration Implications

- `bench --site <site> migrate` required to apply new Omni Identity fields (`needs_review`, `potential_duplicate_of`).
- Alias source field now has four options (Inbound, Auto, Manual, Import). Existing aliases with old source values remain valid.
- All other changes are runtime-only (hooks, scheduler, service logic). No existing data is modified.

---

## Implementation Update (2026-02-24, Linked ERP Entities in Sidebar)

Linked ERP Entities from the Omni Identity doctype are now displayed in the right sidebar when a conversation is opened.

### What Changed

- **Backend**: Added `get_linked_entities(omni_identity)` whitelisted API in `excom.excom.api.chat` that fetches all Omni Identity Link child table rows and returns `{linked_doctype, linked_name, role, title}` for each. The `title` is derived from the linked doc (e.g. `lead_name`, `customer_name`) for human-readable display.
- **Frontend**: Added `useLinkedEntities(omniIdentity)` hook that calls the API. OmniIdentityPanel and MobileContactView now render a "Linked ERP Entities" section with loading/empty/list states. Each entity is shown as a clickable card (doctype badge, title, role) that opens the Frappe Form in a new tab via `/app/{doctype}/{docname}`.

### Impacted Modules

- `excom/excom/api/chat.py` — new `get_linked_entities` method
- `frontend/src/hooks/useLinkedEntities.ts` — new hook
- `frontend/src/components/OmniIdentityPanel.tsx` — Linked ERP Entities section
- `frontend/src/components/mobile/MobileContactView.tsx` — same section for mobile

---

## Implementation Update (2026-02-24, Phase 1 — Backend Architecture Hardening)

Complete implementation of Phase 1 from the roadmap: schema improvements, validation hardening, performance indexes, unified error handling, WhatsApp service layer extraction, event bus, and settings consolidation.

### What Changed

#### 1.1 Schema Improvements
- **WhatsApp Message** — added lifecycle timestamp fields (`queued_at`, `sent_at`, `delivered_at`, `read_at`, `failed_at`, `failure_reason`), raw body field (`body`), and media metadata fields (`media_id`, `media_url`, `media_mime_type`, `media_sha256`, `media_caption`, `media_filename`)
- **WhatsApp Account** — added health/rate-limit fields (`rate_limit_per_second`, `rate_limit_per_day`, `last_health_check`, `health_status`, `token_expires_at`, `webhook_url`). Marked `token`, `url`, `version`, `phone_id` as required.
- **WhatsApp Templates** — added approval lifecycle fields (`submitted_at`, `approved_at`, `rejected_at`, `rejection_reason`, `paused_at`). Webhook handler now populates these on template status events from Meta.
- **Bulk WhatsApp Message** — added `failed_count` and `completed_at` fields
- **WhatsApp Notification** — added missing field definitions for `enable_delay`, `delay_value`, `delay_unit`

#### 1.2 Validation Improvements
- **E.164 phone validation** — new `excom/excom/utils/phone.py` with `validate_phone_number()` and `normalize_phone()` utilities. Enforces 7-15 digit length, country code requirement.
- **WhatsApp Templates** — button count validation: max 3 Quick Reply, max 2 CTA (Visit Website/Call Phone)
- **WhatsApp Notification** — delay field validation: `delay_value` must be positive int, `delay_unit` required when delay is enabled
- **Bulk WhatsApp Message** — full validation: template requirement when `use_template` checked, `template_variables` JSON format validation, scheduled_time past-date warning, `failed_count` tracking in `create_single_message`
- **WhatsApp Recipient List** — deduplication logic in `validate()` and `import_list_from_doctype()`. Duplicate phone numbers are silently removed with a user notification.

#### 1.3 Performance
- **Database indexes** — patch `add_performance_indexes.py` adds 11 composite indexes across `tabWhatsApp Message`, `tabWhatsApp Notification Log`, `tabExcom Message`, and `tabExcom Thread`
- **Chat API** — verified `get_threads` is a zero-join, zero-subquery single table scan. Already optimal.

#### 1.4 Architecture
- **Unified error handling** — new `excom/excom/utils/errors.py` with `ExcomError` base class and subclasses: `ExcomValidationError`, `ExcomProviderError`, `ExcomRateLimitError`, `ExcomIdentityError`. All include structured context and `.log()` for Error Log persistence.
- **Event bus** — `thread_service.py` now calls `frappe.publish_realtime()` for four events: `excom:message_received`, `excom:message_sent`, `excom:message_status_updated`, `excom:thread_updated`. Frontend can subscribe for real-time inbox updates.
- **WhatsApp service layer** — new `excom/excom/services/whatsapp_service.py` with `send_text_message()`, `send_template_message()`, `send_media_message()`, `wa_update_delivery_status()`. Single entry point for all WhatsApp Cloud API calls. Includes credential resolution for both Excom Channel Account and legacy WhatsApp Account. Thread service's `_send_whatsapp()` replaced with service layer calls.
- **Settings consolidation** — `WhatsApp Account.on_update()` now syncs `is_default_incoming`/`is_default_outgoing` flags to `WhatsApp Settings` single DocType bidirectionally. Also auto-computes `webhook_url`.

### Impacted Modules
- `excom/excom/doctype/whatsapp_message/whatsapp_message.json` — 13 new fields
- `excom/excom/doctype/whatsapp_account/whatsapp_account.json` — 7 new fields, 4 fields marked required
- `excom/excom/doctype/whatsapp_account/whatsapp_account.py` — validate + sync_to_settings
- `excom/excom/doctype/whatsapp_templates/whatsapp_templates.json` — 6 new fields
- `excom/excom/doctype/whatsapp_templates/whatsapp_templates.py` — button count validation
- `excom/excom/doctype/whatsapp_notification/whatsapp_notification.json` — 3 new field definitions
- `excom/excom/doctype/whatsapp_notification/whatsapp_notification.py` — delay field validation
- `excom/excom/doctype/bulk_whatsapp_message/bulk_whatsapp_message.json` — 2 new fields
- `excom/excom/doctype/bulk_whatsapp_message/bulk_whatsapp_message.py` — full validation + failed_count tracking
- `excom/excom/doctype/whatsapp_recipient_list/whatsapp_recipient_list.py` — deduplication
- `excom/excom/utils/phone.py` — new file
- `excom/excom/utils/errors.py` — new file
- `excom/excom/services/whatsapp_service.py` — new file
- `excom/excom/services/thread_service.py` — event bus + service layer integration, removed `_send_whatsapp`
- `excom/excom/utils/webhook.py` — template lifecycle timestamps, WA message status timestamps
- `excom/patches/v1_0/add_performance_indexes.py` — new patch
- `excom/patches.txt` — registered new patch

### Migration Implications
- `bench --site <site> migrate` required to apply all schema changes (new fields on WhatsApp Message, Account, Templates, Notification, Bulk WhatsApp Message) and run the index patch.
- All new fields are additive — no existing data is broken.
- The `token`, `url`, `version`, `phone_id` fields on WhatsApp Account are now required. Existing accounts missing these values will need to be updated before they can be saved again.
