# Phase 1: Schema, Validation, and Backend Architecture Hardening

Priority: HIGH
Estimated Effort: 5-8 days
Dependency: Phase 0 complete

---

## Objective

Harden the backend data model, add missing fields and validations, fix performance bottlenecks, and extract a clean service layer architecture. This phase makes the existing WhatsApp channel production-grade before adding new channels.

---

## 1.1 Schema Improvements

### 1.1.1 WhatsApp Message — Timestamp Fields

Add lifecycle timestamp fields for operational observability:

| Field | Type | Purpose |
|---|---|---|
| `queued_at` | Datetime | When the message entered the send queue |
| `sent_at` | Datetime | When Meta accepted the message |
| `delivered_at` | Datetime | When webhook reported delivery |
| `read_at` | Datetime | When webhook reported read receipt |
| `failed_at` | Datetime | When sending failed |
| `failure_reason` | Small Text | Error detail from Meta API response |

- **Complexity:** Medium (schema + webhook handler updates to populate)

### 1.1.2 WhatsApp Message — Body and Media Fields

Add raw text and incoming media metadata:

| Field | Type | Purpose |
|---|---|---|
| `body` | Long Text | Raw plain-text content from `messages[0].text.body` |
| `media_id` | Data | WhatsApp media ID from webhook |
| `media_url` | Data | Downloaded/cached file URL |
| `media_mime_type` | Data | MIME type |
| `media_sha256` | Data | SHA256 hash for integrity |
| `media_caption` | Small Text | Caption sent with media |
| `media_filename` | Data | Original filename |

- **Complexity:** Medium

### 1.1.3 WhatsApp Account — Rate Limit and Health Fields

| Field | Type | Purpose |
|---|---|---|
| `rate_limit_per_second` | Int | Provider rate limit |
| `rate_limit_per_day` | Int | Daily throughput cap |
| `last_health_check` | Datetime | Last successful API call |
| `health_status` | Select | Healthy/Degraded/Down |
| `token_expires_at` | Datetime | Token expiry for proactive rotation |
| `webhook_url` | Data (read-only) | Auto-computed webhook URL |

Mark `token`, `url`, `version`, `phone_id` as required (`reqd: 1`).

- **Complexity:** Medium

### 1.1.4 WhatsApp Templates — Approval Lifecycle Fields

| Field | Type | Purpose |
|---|---|---|
| `submitted_at` | Datetime | When sent to Meta for review |
| `approved_at` | Datetime | Meta approval timestamp |
| `rejected_at` | Datetime | Meta rejection timestamp |
| `rejection_reason` | Small Text | Reason from Meta |
| `paused_at` | Datetime | Meta pause timestamp |

- **Complexity:** Low

### 1.1.5 WhatsApp Notification Log — Missing Index

Add composite index on `(status, scheduled_for)` for the pending-log processor.

- **Complexity:** Low

---

## 1.2 Validation Improvements

### 1.2.1 Phone Number E.164 Validation

Create shared `validate_phone_number()` in `excom/excom/utils/phone.py`:
- Enforce 7-15 digit length
- Require country code
- Strip non-numeric characters
- Use in all DocType `validate()` methods: WhatsApp Message, WhatsApp Profiles, WhatsApp Recipient, WhatsApp Notification

- **Complexity:** Medium

### 1.2.2 WhatsApp Templates — Button Count Validation

Add `validate()` logic to enforce:
- Max 3 buttons for Quick Reply type
- Max 2 buttons for CTA type

- **Complexity:** Low

### 1.2.3 WhatsApp Notification — Delay Field Validation

When `enable_delay` is checked, validate:
- `delay_value` is a positive integer
- `delay_unit` has a valid selection

- **Complexity:** Low

### 1.2.4 Bulk WhatsApp Message — Full Validation

- Uncomment and fix `validate_message()` method
- Validate `template_variables` JSON format
- Validate `recipient_count` vs actual recipient rows
- Handle `scheduled_time` field (currently ignored)
- Add `failed_count` and `completed_at` fields

- **Complexity:** Medium

### 1.2.5 WhatsApp Recipient List — Deduplication

Add deduplication logic in `import_list_from_doctype()` and a `validate()` check to prevent duplicate phone numbers in the same list.

- **Complexity:** Low

---

## 1.3 Performance Fixes

### 1.3.1 Database Indexes

Add missing indexes:
- `tabWhatsApp Message`: `(to, creation)`, `(from, creation)`, `(message_id)`, `(status, type, from)`
- `tabWhatsApp Notification Log`: `(status, scheduled_for)`
- `tabExcom Message`: verify `(provider_message_id)` and `(thread, creation)` exist
- `tabExcom Thread`: verify `(thread_key)`, `(last_message_at)`, `(omni_identity, channel, account)` exist

- **Complexity:** Low (patch file)

### 1.3.2 Eliminate N+1 Query in Chat API

Cache `last_message_at`, `last_message_preview`, `unread_count` directly on Excom Thread (already partially done). Ensure the `get_threads` API returns these without subqueries.

Verify the inbox query is: `SELECT ... FROM tabExcom Thread ORDER BY last_message_at DESC LIMIT N` with zero joins.

- **Complexity:** Medium

---

## 1.4 Architecture Improvements

### 1.4.1 Unified Error Handling

Create `excom/excom/utils/errors.py`:
- `ExcomError` base exception class
- `ExcomValidationError`, `ExcomProviderError`, `ExcomRateLimitError` subclasses
- Consistent logging pattern: `frappe.log_error()` for unexpected errors, structured error returns for API responses

- **Complexity:** Medium

### 1.4.2 Event Bus for Cross-Concern Communication

Add `frappe.publish_realtime("excom:message_received", ...)` from the webhook handler and `thread_service.py` so that:
- Frontend can subscribe for realtime updates
- Future modules (CRM sync, AI profiling, ticket linking) can hook in without modifying webhook code

Events to publish:
- `excom:message_received` — new inbound message
- `excom:message_sent` — outbound message successfully sent
- `excom:message_status_updated` — delivery status change
- `excom:thread_updated` — thread counters/status changed

- **Complexity:** Medium

### 1.4.3 WhatsApp Service Layer Extraction

Extract `WhatsAppMessageService` in `excom/excom/services/whatsapp_service.py`:
- `send_text_message(account, to, content)`
- `send_template_message(account, to, template, variables)`
- `send_media_message(account, to, media_type, file_url)`
- `process_inbound_event(payload)`
- `update_delivery_status(provider_message_id, status)`

Both the webhook handler and the DocType controller should call this service instead of calling the WhatsApp API directly. This enables adding rate limiting, retries, circuit-breaking as middleware.

- **Complexity:** High

### 1.4.4 WhatsApp Settings Consolidation

Resolve the conflict between `WhatsApp Settings` (`default_incoming_account`, `default_outgoing_account`) and `WhatsApp Account` (`is_default_incoming`, `is_default_outgoing`) flags. Either:
- Remove Settings DocType and use account-level flags only
- Add `validate()` that syncs them bidirectionally

- **Complexity:** Low

---

## Validation Checklist

- [x] All new fields are additive (no existing data broken)
- [x] Phone numbers are validated E.164 across all DocTypes
- [x] Template button counts are enforced
- [x] Delayed notification fields are validated
- [x] Chat API sidebar loads in single query
- [x] All events publish to realtime bus
- [x] WhatsApp send/receive goes through service layer

---

## Handbook Updates Required

- [x] `technical_handbook.md`: Document new fields, service layer, error model, event bus
- [x] `yet_to_improve.md`: Mark items 4-16, 22-23, 21, 28-30 as resolved
- [x] `whatsapp_handbook.md`: Update "Data Needed in Excom for WhatsApp" with new fields

---

## Implementation Status: COMPLETED (2026-02-24)
