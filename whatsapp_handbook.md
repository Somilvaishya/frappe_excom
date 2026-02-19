# Excom WhatsApp Handbook

## Purpose

This handbook is the deep working guide for WhatsApp inside `excom`.
It captures:

- Meta WhatsApp Business Platform requirements
- Cloud API endpoint families and integration needs
- webhook/event design
- migration/reuse strategy from installed Frappe WhatsApp apps

This is a summary handbook for implementation, not a replacement for official Meta docs.

## Primary Source Index (Official)

- Overview: `https://developers.facebook.com/documentation/business-messaging/whatsapp/overview`
- Cloud API getting started: `https://developers.facebook.com/docs/whatsapp/cloud-api/get-started/`
- Cloud API reference root: `https://developers.facebook.com/docs/whatsapp/cloud-api/reference/`
- Messages API reference: `https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages/`
- Messages webhook reference: `https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/reference/messages/`
- Webhook payload examples: `https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples/`
- Access tokens: `https://developers.facebook.com/docs/whatsapp/access-tokens/`
- Media reference: `https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media/`
- Phone numbers reference: `https://developers.facebook.com/docs/whatsapp/cloud-api/reference/phone-numbers/`
- Business profiles reference: `https://developers.facebook.com/docs/whatsapp/cloud-api/reference/business-profiles/`
- Message template guide: `https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates/`
- Template library: `https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates/template-library/`

## WhatsApp Platform Model (What Excom Must Respect)

1. Business identity is tied to Meta Business + WhatsApp Business Account (WABA).
2. One channel (`whatsapp`) can have multiple accounts and multiple phone numbers.
3. Inbound and outbound are event-driven, webhook-first.
4. Template messages are required outside policy windows and must be approved.
5. Media is token-protected and must be fetched securely.
6. Delivery lifecycle is asynchronous (sent, delivered, read, failed).

## Core Integration Primitives

Excom needs these primitives in services:

- `token_provider`: produce bearer token per WhatsApp account.
- `endpoint_builder`: `{base_url}/{graph_version}/{object_id}/{edge}`.
- `webhook_verifier`: verify challenge + account-level verify token.
- `message_sender`: send typed messages and capture message IDs.
- `status_updater`: map webhook statuses to local records.
- `media_fetcher`: fetch metadata and binary safely.
- `template_manager`: sync/create/update/delete templates.
- `flow_manager`: create/publish/sync/preview flow assets.

## API Families Excom Must Support

Exact versioned paths can evolve; Excom should keep them configurable through account settings.

### 1) Send Messages

Primary pattern:

- `POST /{phone_number_id}/messages`

Supported payload classes needed by Excom:

- text
- media (image/document/video/audio)
- template
- interactive (button/list)
- reaction
- status update payload (read receipts)
- flow interactive payload (where enabled)

Expected handling:

- Persist outgoing request intent
- Persist Meta message ID on success
- Persist provider error details on failure

### 2) Templates

Typical patterns:

- list templates under WABA
- create template under WABA
- delete template by name/reference
- update template components where supported

Excom requirement:

- Keep template state in sync (approved/rejected/paused status changes from webhook/events)
- Support template component mapping (body/header/footer/buttons)

### 3) Flows

Typical patterns used in current stack:

- create flow under business account
- upload flow JSON assets
- publish/deprecate
- fetch flow metadata
- fetch/download flow assets for sync

Excom requirement:

- treat flow definitions as deployable assets
- support import from Meta and local round-trip

### 4) Media

Typical lifecycle:

- send via link or media handle
- retrieve media metadata by media ID
- fetch signed media URL/binary with auth header

Excom requirement:

- scan/validate files before broad internal reuse
- keep attachment references in message timeline

### 5) Account/Phone/Profile

Required management surfaces:

- business phone number configuration
- business profile fields
- phone number verification and account readiness checks

## Webhook Contract (Critical)

Webhook endpoint behavior for Excom:

1. `GET` challenge:
   - validate verify token
   - return `hub.challenge`
2. `POST` events:
   - persist raw event payload (for replay/audit)
   - process idempotently
   - branch by event type

Event classes Excom must parse:

- incoming messages
- interactive replies (button/list)
- flow replies (`nfm_reply`-style payloads)
- media messages
- message status updates
- template status updates

Idempotency keys:

- inbound message ID
- status event ID + timestamp where provided

## Authentication and Token Strategy

Meta guidance distinguishes temporary and long-lived/system user token flows.

Excom policy:

- never hardcode tokens
- store token in secure password field
- support token rotation without downtime
- implement account health checks and alerting before expiry

## Data Needed in Excom for WhatsApp

Minimum account-level fields:

- account label
- graph base URL
- graph version
- phone number ID
- business account ID
- app ID (if required by feature)
- webhook verify token
- encrypted access token
- default incoming/outgoing flags
- enabled flag

Minimum message-level fields:

- external message ID
- direction
- from/to phone
- content type
- text/caption/payload
- attachment reference
- status
- conversation/external conversation ID when available
- related account

## WhatsApp Implementation Status

### Migration Complete

All WhatsApp functionality has been migrated from the legacy WhatsApp app into Excom. The following DocTypes are now part of the Excom module:

- `WhatsApp Account`
- `WhatsApp Message`
- `WhatsApp Templates`
- `WhatsApp Notification`
- `Bulk WhatsApp Message`
- `WhatsApp Flow`
- `WhatsApp Profiles`
- `WhatsApp Notification Log`
- `WhatsApp Recipient List`
- `WhatsApp Recipient`
- `WhatsApp Button`
- `WhatsApp Flow Field`
- `WhatsApp Flow Screen`
- `WhatsApp Message Fields`
- `WhatsApp Settings`

API endpoints and webhook handlers are now under the `excom` namespace:
- Webhook: `/api/method/excom.excom.channels.whatsapp.api.webhook`
- Flow endpoint: `/api/method/excom.excom.channels.whatsapp.api.handle_flow_request`

All imports use `excom.excom.*` instead of legacy package paths.

### Reuse from `whatsapp_chat`

- `WhatsApp Contact` for operator-focused contact room behavior

### Reuse from WhatsApp Chatbot app

- chatbot sessions, flow steps, keyword rules, and transfer controls

## Excom Architecture Decision for WhatsApp

1. Keep channel registry in `Excom Channel` with seeded `whatsapp`.
2. Do not duplicate core WhatsApp data models in phase 1.
3. Build service adapters around existing WhatsApp DocTypes.
4. Add Excom-specific link/routing models only when unavoidable.

## Implementation Blueprint (WhatsApp in Excom)

### Phase A: Stabilize provider adapter

- account resolver
- send message service wrapper
- inbound webhook parser
- status/event updater
- centralized error object mapping

### Phase B: Unified timeline read model

- aggregate `WhatsApp Message` + contact + CRM/helpdesk links
- normalize to Excom conversation DTOs for frontend consumption

### Phase C: Operational controls

- retries and dead-letter behavior
- account failover selection (default incoming/outgoing)
- telemetry counters and latency/error dashboards

### Phase D: AI contact profile feed

- summarize message history per `Contact`
- tag behavior and intent
- persist summary fields on `Contact` custom fields

## Security and Compliance Requirements

- validate webhook verification token per account
- retain raw inbound payload for traceability
- enforce role checks for send operations
- mask sensitive token material in logs and UI
- secure media retrieval and scanning pipeline

## Migration Status

- ✅ All WhatsApp DocTypes migrated from the legacy WhatsApp app to Excom
- ✅ All imports updated to use `excom.excom.*` namespace
- ✅ Webhook endpoints updated to use Excom namespace
- ✅ Hooks merged into Excom hooks.py
- ✅ Patches integrated into Excom patches.txt

## Open Questions to Resolve Before Deep Build

1. Final token lifecycle policy (system user long-lived token ops playbook).
2. Hard limits for media size/types and bench-side storage policy.
3. Exact throughput and queueing strategy per account for high-volume sends.
4. Conversation ownership sync between Excom, CRM, and Helpdesk.
5. SLA model mapping for WhatsApp-specific delivery/status edge cases.

## Change Log

### 2026-02-20

- Added dedicated WhatsApp handbook for Excom.
- Consolidated official Meta source links starting from overview doc.
- Mapped WhatsApp API families to Excom service responsibilities.
- Documented reuse-first migration map from installed WhatsApp apps.
