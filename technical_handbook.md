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
