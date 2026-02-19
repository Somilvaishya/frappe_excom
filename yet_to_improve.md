# Excom: Yet To Improve

Comprehensive audit of WhatsApp doctypes, API layer, and frontend after building the initial chat application. Items are prioritized by severity.

---

## Critical Bugs (Fix Immediately)

### 1. Bulk WhatsApp Message — Status Assignment Bug

**File:** `bulk_whatsapp_message.py`, `on_submit()` method  
**Issue:** `self.status == "In Progress"` uses comparison (`==`) instead of assignment (`=`).  
**Impact:** Bulk message status never updates to "In Progress" after submission. The UI shows "Queued" forever.  
**Fix:** Change `==` to `=`.

### 2. hooks.py — Missing Scheduler Hooks

**File:** `excom/hooks.py`  
**Issue:** `scheduler_events` block is entirely commented out. The delayed notification log processor (`process_pending_whatsapp_notification_logs`) and the notification trigger functions (`trigger_whatsapp_notifications_*`) are never called by the scheduler.  
**Impact:** Scheduled WhatsApp notifications (hourly/daily/weekly/monthly), date-based notifications (Days Before/After), and delayed notifications all silently fail to fire.  
**Fix:** Uncomment and configure:
```python
scheduler_events = {
    "all": [
        "excom.excom.utils.process_pending_whatsapp_notification_logs",
    ],
    "hourly": [
        "excom.excom.utils.trigger_whatsapp_notifications_hourly",
    ],
    "daily": [
        "excom.excom.utils.trigger_whatsapp_notifications_daily",
    ],
    "weekly": [
        "excom.excom.utils.trigger_whatsapp_notifications_weekly",
    ],
    "monthly": [
        "excom.excom.utils.trigger_whatsapp_notifications_monthly",
    ],
}
```

### 3. hooks.py — Missing doc_events for WhatsApp Notifications

**File:** `excom/hooks.py`  
**Issue:** No `doc_events` hook is configured to call `run_server_script_for_doc_event` on document events. WhatsApp notifications triggered by DocType events (After Insert, After Save, on Submit, etc.) never fire.  
**Impact:** The entire WhatsApp Notification automation system for DocType events is non-functional.  
**Fix:** Add:
```python
doc_events = {
    "*": {
        "validate": "excom.excom.utils.run_server_script_for_doc_event",
        "on_update": "excom.excom.utils.run_server_script_for_doc_event",
        "after_insert": "excom.excom.utils.run_server_script_for_doc_event",
        "on_submit": "excom.excom.utils.run_server_script_for_doc_event",
        "on_cancel": "excom.excom.utils.run_server_script_for_doc_event",
        "on_trash": "excom.excom.utils.run_server_script_for_doc_event",
    }
}
```

---

## High Priority (Schema Improvements)

### 4. WhatsApp Message — Missing Timestamp Fields

**Current state:** Only `creation` and `modified` (auto-managed by Frappe) exist.  
**Missing fields:**
| Field | Type | Purpose |
|---|---|---|
| `queued_at` | Datetime | When the message entered the send queue |
| `sent_at` | Datetime | When Meta accepted the message |
| `delivered_at` | Datetime | When the webhook reported delivery |
| `read_at` | Datetime | When the webhook reported read receipt |
| `failed_at` | Datetime | When sending failed |
| `failure_reason` | Small Text | Error detail from Meta API response |

**Why it matters:** Without these, there is no way to measure send latency, delivery SLA, or diagnose failures from the message record alone. The `status` field only stores the final state, not the transition timeline.

### 5. WhatsApp Message — Missing `body` Text Field

**Current state:** The `message` field is `HTML Editor` type. Incoming webhook text is stored directly but the separate `body` (plain text) is not persisted.  
**Issue found during chat build:** The body param stays empty on incoming messages while other params fill correctly.  
**Recommendation:** Add a `body` (Long Text) field for the raw plain-text content, separate from the HTML-rendered `message` field. The webhook handler should populate `body` from `messages[0].text.body` and also set `message` to the same value for backward compatibility.

### 6. WhatsApp Message — Missing Media Fields

**Current state:** There is an `attach` field for outgoing attachments, but no dedicated fields for incoming media metadata.  
**Missing fields:**
| Field | Type | Purpose |
|---|---|---|
| `media_id` | Data | WhatsApp media ID from webhook |
| `media_url` | Data | Downloaded/cached file URL |
| `media_mime_type` | Data | MIME type of the media |
| `media_sha256` | Data | SHA256 hash for integrity |
| `media_caption` | Small Text | Caption sent with media |
| `media_filename` | Data | Original filename |

**Why it matters:** The chat frontend cannot display images or documents without these fields. Currently the webhook downloads media but has no structured place to store the reference.

### 7. WhatsApp Profiles — Insufficient for Chat

**Current state:** Only 5 fields: `profile_name`, `number`, `contact`, `title`, `whatsapp_account`.  
**Missing fields:**
| Field | Type | Purpose |
|---|---|---|
| `profile_picture_url` | Data | WhatsApp profile picture URL |
| `last_message_at` | Datetime | Timestamp of last message (enables fast sort without subquery) |
| `last_message_preview` | Data | Cached last message snippet |
| `last_message_type` | Select | Incoming/Outgoing |
| `unread_count` | Int | Cached unread count (avoid COUNT query per contact in sidebar) |
| `is_blocked` | Check | Whether this contact is blocked |
| `assigned_to` | Link → User | Agent assignment for this contact |
| `tags` | Small Text | Comma-separated tags for filtering |

**Why it matters:** The current chat API performs N+1 queries (one per profile) to compute last_message and unread_count. Caching these on the profile would make the sidebar load O(1) instead of O(N). The `assigned_to` field is needed for multi-agent support (who owns this conversation).

### 8. WhatsApp Account — Missing Rate Limit and Health Fields

**Missing fields:**
| Field | Type | Purpose |
|---|---|---|
| `rate_limit_per_second` | Int | Provider rate limit |
| `rate_limit_per_day` | Int | Daily throughput cap |
| `last_health_check` | Datetime | Last successful API call |
| `health_status` | Select | Healthy/Degraded/Down |
| `token_expires_at` | Datetime | Token expiry for proactive rotation |
| `webhook_url` | Data (read-only) | Auto-computed webhook URL for convenience |

**Why it matters:** No rate limiting means a bulk send can exhaust the account's API quota and cause cascading failures. No health check means operators discover outages only after customers complain.

### 9. WhatsApp Account — Missing Required Flags

**Current state:** `token`, `url`, `version`, `phone_id` are all optional (no `reqd: 1`).  
**Fix:** Mark `token`, `url`, `version`, `phone_id` as required. An account without these cannot function.

---

## Medium Priority (Validation and Logic Gaps)

### 10. Phone Number Format Validation

**Affected doctypes:** WhatsApp Message, WhatsApp Profiles, WhatsApp Recipient, WhatsApp Notification.  
**Issue:** `format_number()` in utils only strips `+`. No validation for:
- Minimum/maximum length (E.164 standard: 7-15 digits)
- Country code presence
- Non-numeric characters

**Recommendation:** Create a shared `validate_phone_number()` that enforces E.164 format and use it in all `validate()` methods.

### 11. WhatsApp Templates — Missing Approval Lifecycle Fields

**Missing fields:**
| Field | Type | Purpose |
|---|---|---|
| `submitted_at` | Datetime | When template was sent to Meta for review |
| `approved_at` | Datetime | When Meta approved it |
| `rejected_at` | Datetime | When Meta rejected it |
| `rejection_reason` | Small Text | Reason from Meta |
| `paused_at` | Datetime | When Meta paused it |

**Why it matters:** Template status changes arrive via webhook but only update the `status` string. Without timestamps, there is no audit trail for compliance reporting.

### 12. WhatsApp Templates — Button Count Validation

**Issue:** WhatsApp allows max 3 buttons per template (for Quick Reply) or 2 (for CTA). No validation enforces this limit.  
**Fix:** Add `validate()` logic to check button count by type.

### 13. WhatsApp Notification — Delay Field Validation

**Issue:** When `enable_delay` is checked, `delay_value` and `delay_unit` are not validated for:
- Non-empty value
- Positive integer for delay_value
- Valid delay_unit selection

**Fix:** Add conditional validation in `validate()`.

### 14. Webhook Idempotency

**File:** `webhook.py`  
**Issue:** No deduplication check on incoming message IDs. If Meta retries a webhook delivery (which it does), duplicate `WhatsApp Message` records can be created.  
**Fix:** Before creating an incoming message, check `frappe.db.exists("WhatsApp Message", {"message_id": msg_id})`. Skip if exists.

### 15. Bulk WhatsApp Message — Missing Validation

**Issues:**
- `validate_message()` method is commented out
- No validation for `template_variables` JSON format
- No validation for `recipient_count` vs actual recipient rows
- No handling for `scheduled_time` (field exists but is never checked)
- No `failed_count` or `completed_at` fields for operational visibility

### 16. WhatsApp Recipient List — No Deduplication

**Issue:** Importing recipients from a DocType can create duplicate phone numbers in the same list. No validation prevents this.  
**Fix:** Add deduplication logic in `import_list_from_doctype()` and a `validate()` check.

---

## Low Priority (UX and Frontend Improvements)

### 17. Chat Frontend — No Realtime Updates

**Current state:** The chat polls every 5 seconds for new messages and 10 seconds for contact list refresh.  
**Improvement:** Use Frappe's Socket.IO realtime system (`frappe.realtime.publish` in webhook handler, `useFrappeEventListener` in frontend) to push new messages instantly without polling.

### 18. Chat Frontend — No Mobile Responsive Layout

**Current state:** The sidebar is always visible. On mobile screens (<768px), the sidebar should take full width, and clicking a contact should hide the sidebar and show the chat.  
**Fix:** Add responsive breakpoint logic with a mobile-first layout toggle.

### 19. Chat Frontend — No Media Send Support

**Current state:** Only text messages can be sent from the chat UI. The `+` button and emoji button are non-functional placeholders.  
**Phase 2:** Enable file upload via the `+` button, sending media messages through the WhatsApp Cloud API media upload flow.

### 20. Chat Frontend — Profile Header Incomplete

**Current state:** The header shows avatar, name, and phone number. No additional context is shown.  
**Improvement:** Show online/offline status (if available from WhatsApp), link to Contact/Lead/Ticket, and quick actions (create ticket, assign to agent, view in CRM).

### 21. WhatsApp Settings — Redundant with Account Defaults

**Issue:** `WhatsApp Settings` has `default_incoming_account` and `default_outgoing_account`, but `WhatsApp Account` also has `is_default_incoming` and `is_default_outgoing` flags. These can get out of sync.  
**Recommendation:** Remove the Settings doctype and rely solely on the account-level flags, or add a `validate()` that syncs them bidirectionally.

---

## Performance Concerns

### 22. Chat API — N+1 Query Pattern in get_contacts

**Current state:** For each profile, two separate SQL queries run (last message + unread count). With 100 profiles, that's 200 extra queries.  
**Fix options:**
1. Cache `last_message_at`, `last_message_preview`, `unread_count` on WhatsApp Profiles (update via webhook handler and send handler).
2. Use a single SQL query with subqueries or JOINs to fetch all profiles with their last message in one round trip.

### 23. Missing Database Indexes

**Affected tables:**
- `tabWhatsApp Message`: Index on `(to, creation)` and `(from, creation)` for chat queries. Index on `(message_id)` for webhook dedup. Index on `(status, type, from)` for unread counts.
- `tabWhatsApp Notification Log`: Index on `(status, scheduled_for)` for pending log processor.
- `tabWhatsApp Profiles`: Index on `(number)` already exists (unique), but add index on `(modified)` for sidebar sorting.

### 24. Webhook Handler — No Background Processing

**Current state:** The POST webhook handler processes the entire payload synchronously (creates message records, downloads media, updates statuses).  
**Risk:** If processing takes too long, Meta may mark the webhook as failing and reduce delivery reliability.  
**Fix:** Accept the webhook immediately (return 200), then enqueue the actual processing via `frappe.enqueue()`.

---

## Security Gaps

### 25. No Input Sanitization on Send

**File:** `api/chat.py`, `send_message()`  
**Issue:** The `message` parameter is sent directly to Meta's API without sanitization. While Meta handles this server-side, we should strip dangerous content before persisting it in our database.

### 26. No Rate Limiting on Send API

**File:** `api/chat.py`, `send_message()`  
**Issue:** Any authenticated user can call `send_message()` in a tight loop with no throttling. This could exhaust the WhatsApp API quota.  
**Fix:** Add rate limiting per user/per account using a simple Redis counter or Frappe's `frappe.rate_limiter`.

### 27. Webhook Verify Token Validation

**File:** `webhook.py`  
**Issue:** The webhook GET handler iterates all accounts to find a matching verify token. If no account matches, it falls through silently. Should return an explicit 403.  
**Also:** The POST handler trusts the payload without verifying the `X-Hub-Signature-256` header (HMAC validation using the app secret). This is a security requirement from Meta.

---

## Architectural Debt

### 28. No Unified Error Handling

**Issue:** Each function handles errors differently — some use `frappe.throw()`, some use `frappe.log_error()`, some silently pass. No consistent error model.  
**Recommendation:** Create `excom.excom.utils.errors` with a standard `ExcomError` hierarchy and consistent logging/alerting.

### 29. No Event Bus for Cross-Concern Communication

**Issue:** When a message arrives, only a WhatsApp Message record is created. There is no event that other modules (CRM contact resolution, Helpdesk ticket linking, AI profile generation, notification routing) can subscribe to.  
**Recommendation:** Publish a `frappe.publish_realtime("excom:message_received", ...)` event from the webhook handler. Future modules can subscribe without coupling to the webhook code.

### 30. Webhook Handler and Message Controller Are Tightly Coupled

**Issue:** `whatsapp_message.py` `before_insert()` directly calls the WhatsApp API. The webhook handler directly creates DocType records. There is no service layer between them.  
**Impact:** Cannot easily add middleware (rate limiting, logging, retry, circuit-breaking) without modifying the DocType controller.  
**Recommendation:** Extract a `WhatsAppMessageService` that both the controller and webhook call. This is the adapter layer described in the WhatsApp handbook but not yet implemented.

---

## Summary Priority Matrix

| Priority | Count | Examples |
|---|---|---|
| **Critical (blocks functionality)** | 3 | Scheduler hooks missing, doc_events missing, bulk status bug |
| **High (data quality)** | 6 | Missing timestamp fields, missing media fields, profile cache fields, account required flags |
| **Medium (validation gaps)** | 7 | Phone validation, template limits, webhook idempotency, recipient dedup |
| **Low (UX/polish)** | 5 | Realtime updates, mobile responsive, media send, profile header |
| **Performance** | 3 | N+1 queries, missing indexes, sync webhook processing |
| **Security** | 3 | Input sanitization, rate limiting, HMAC validation |
| **Architecture** | 3 | Error handling, event bus, service layer |
| **Total** | **30** | |

---

## Change Log

### 2026-02-20
- Created initial improvement audit after building the Excom Chat frontend.
- Identified 30 items across 7 categories.
- Cross-referenced findings against whatsapp_handbook.md and technical_handbook.md requirements.
