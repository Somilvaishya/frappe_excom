# Phase 0: Critical Fixes and Stabilization

Priority: IMMEDIATE
Estimated Effort: 2-3 days
Dependency: None (unblocks all other phases)

---

## Objective

Fix the 3 critical bugs that make core WhatsApp functionality non-operational, stabilize the scheduler and doc_events pipeline, and harden the identity resolution system to prevent person-level fragmentation before multi-channel expansion.

---

## 0.1 Bulk WhatsApp Message Status Assignment Bug

- **File:** `excom/excom/doctype/bulk_whatsapp_message/bulk_whatsapp_message.py`
- **Bug:** `self.status == "In Progress"` uses comparison instead of assignment in `on_submit()`.
- **Impact:** Bulk message status never transitions from "Queued" to "In Progress." UI shows stale status forever.
- **Fix:** Change `==` to `=`.
- **Complexity:** Low

---

## 0.2 Missing Scheduler Hooks in hooks.py

- **File:** `excom/hooks.py`
- **Bug:** The `scheduler_events` block is entirely commented out.
- **Impact:** The following never fire:
  - `process_pending_whatsapp_notification_logs` (delayed notification dispatch)
  - `trigger_whatsapp_notifications_hourly`
  - `trigger_whatsapp_notifications_daily`
  - `trigger_whatsapp_notifications_weekly`
  - `trigger_whatsapp_notifications_monthly`
- **Fix:** Uncomment and configure the scheduler_events block:

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

- **Complexity:** Low

---

## 0.3 Missing doc_events for WhatsApp Notifications

- **File:** `excom/hooks.py`
- **Bug:** No `doc_events` hook calls `run_server_script_for_doc_event`. WhatsApp notifications triggered by DocType events (After Insert, After Save, on Submit, etc.) never fire.
- **Impact:** The entire WhatsApp Notification automation system for DocType events is non-functional.
- **Fix:** Add wildcard doc_events:

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

- **Complexity:** Low

---

## 0.4 Webhook Async Processing

- **File:** `excom/excom/channels/whatsapp/api.py` (webhook handler)
- **Bug:** POST webhook processes entire payload synchronously (create records, download media, update statuses).
- **Risk:** If processing takes >5s, Meta marks the webhook as failing and reduces delivery reliability.
- **Fix:** Accept webhook immediately (return 200), enqueue actual processing via `frappe.enqueue()`.
- **Complexity:** Medium

---

## 0.5 Webhook Idempotency Guard

- **File:** Webhook handler
- **Bug:** No deduplication check on incoming message IDs. Meta retries webhook deliveries, causing duplicate `WhatsApp Message` / `Excom Message` records.
- **Fix:** Before creating an incoming message, check `frappe.db.exists("Excom Message", {"provider_message_id": msg_id})`. Skip if exists.
- **Complexity:** Low

---

## 0.6 Identity Resolution Hardening — Prevent Person Fragmentation

### The Problem

`resolve_identity()` in `omni_identity.py` matches on phone, alias, channel_user_id, and email independently. When the same real person reaches out with a brand-new identifier that shares zero overlap with their existing record, the system creates a duplicate Omni Identity.

Example scenario:
1. Person messages via WhatsApp from `+91 98765 00001` — creates Omni Identity A (phone only).
2. Same person later sends an email from `john@acme.com` — no phone match, no channel match, no email match — creates Omni Identity B.
3. One real person now has two identities. All downstream (threads, AI profile, ERP links) are fragmented.

This must be fixed before Phase 3 (Email + Web Chat) dramatically increases the fragmentation surface.

### Solution: Multi-Layer Resolution Chain

The current 4-step match sequence stays as-is. Three new layers are inserted between "no match found" and "create new identity."

#### Layer 1 (existing): Direct Identifier Match
Already implemented. Matches normalized_phone, alias phone, channel_user_id, normalized_email.

#### Layer 2 (NEW): ERPNext Reverse Lookup

Before creating a new identity, check if any ERPNext Contact already has this phone or email registered:

```python
# After all 4 existing match attempts fail:

# Check Contact Phone table
if norm_phone:
    contact_name = frappe.db.get_value(
        "Contact Phone", {"phone": norm_phone}, "parent"
    )
    if contact_name:
        linked_identity = frappe.db.get_value(
            "Omni Identity Link",
            {"linked_doctype": "Contact", "linked_name": contact_name},
            "parent"
        )
        if linked_identity:
            parent_status = frappe.db.get_value("Omni Identity", linked_identity, "status")
            if parent_status != "Merged":
                identity_name = linked_identity

# Check Contact Email table
if not identity_name and norm_email:
    contact_name = frappe.db.get_value(
        "Contact Email", {"email_id": norm_email}, "parent"
    )
    if contact_name:
        linked_identity = frappe.db.get_value(
            "Omni Identity Link",
            {"linked_doctype": "Contact", "linked_name": contact_name},
            "parent"
        )
        if linked_identity:
            parent_status = frappe.db.get_value("Omni Identity", linked_identity, "status")
            if parent_status != "Merged":
                identity_name = linked_identity
```

This is Excom's ERPNext advantage — a Contact in ERPNext often has both phone and email. Even if a person messages from a "new" email, the Contact record acts as the bridge that Rocket.Chat and Chatwoot do not have.

#### Layer 3 (NEW): Auto-Alias Registration

When an existing identity is found and the inbound message carries a phone or email that differs from the primary, auto-register it as an alias so future lookups match directly:

```python
if identity_name:
    identity = frappe.get_doc("Omni Identity", identity_name)

    # Register new phone as alias if different from primary
    if norm_phone and identity.normalized_phone and norm_phone != identity.normalized_phone:
        already_aliased = any(
            a.alias_value_normalized == norm_phone
            for a in identity.get("aliases", [])
        )
        if not already_aliased:
            identity.append("aliases", {
                "alias_type": "Phone",
                "alias_value_raw": phone,
                "alias_value_normalized": norm_phone,
                "verified": 1,
                "source": "auto-resolution",
                "last_seen": frappe.utils.now_datetime(),
            })

    # Same for email
    if norm_email and identity.normalized_email and norm_email != identity.normalized_email:
        already_aliased = any(
            a.alias_value_normalized == norm_email
            for a in identity.get("aliases", [])
        )
        if not already_aliased:
            identity.append("aliases", {
                "alias_type": "Email",
                "alias_value_raw": email,
                "alias_value_normalized": norm_email,
                "verified": 1,
                "source": "auto-resolution",
                "last_seen": frappe.utils.now_datetime(),
            })
```

This makes the identity "learn" new identifiers over time, so the same phone/email resolves instantly on subsequent messages.

#### Layer 4 (NEW): Duplicate Detection Flag

When no match is found at all and a new Omni Identity is created, run a lightweight duplicate check:

- Compare `display_name` against existing active identities (fuzzy or exact).
- Check if the new phone's country-code-stripped version matches any existing `normalized_phone` (handles `919876500001` vs `9876500001`).
- If potential duplicates found, set a flag on the new identity:

```python
doc.needs_review = 1
doc.potential_duplicate_of = suspected_identity_name
```

These appear in a supervisor-facing "Potential Duplicates" queue for manual merge. The merge mechanics already work via `merge_identities()`.

### Complete Resolution Priority Chain

```
1. Match normalized_phone on Omni Identity
2. Match alias phone in Omni Identity Alias
3. Match channel_user_id in Omni Identity Channel
4. Match normalized_email on Omni Identity
5. Match alias email in Omni Identity Alias
6. Reverse lookup via Contact Phone -> linked Omni Identity (NEW)
7. Reverse lookup via Contact Email -> linked Omni Identity (NEW)
8. No match -> Create new identity
   8a. Auto-register new identifiers as aliases on found identity (NEW)
   8b. Flag potential duplicates by name/phone similarity (NEW)
```

### Schema Changes Required

Add to `Omni Identity` DocType:

| Field | Type | Purpose |
|---|---|---|
| `needs_review` | Check (hidden) | Flagged as potential duplicate |
| `potential_duplicate_of` | Link to Omni Identity (hidden) | Suspected duplicate target |

### Why This Must Be in Phase 0

- Phase 3 adds Email and Web Chat channels — every new channel multiplies the fragmentation risk.
- Fixing this after data accumulates means running a painful dedup migration.
- The ERPNext reverse lookup is Excom's unique competitive advantage over Rocket.Chat's contact resolution and must be in the foundation.

- **Complexity:** Medium-High
- **Files:** `excom/excom/doctype/omni_identity/omni_identity.py`, `omni_identity.json`

---

## Validation Checklist

After this phase, verify:

- [ ] Bulk WhatsApp Message transitions to "In Progress" on submit
- [ ] Delayed WhatsApp notifications fire on schedule
- [ ] DocType-event WhatsApp notifications fire on document create/update/submit
- [ ] Webhook returns 200 immediately, processes in background
- [ ] Duplicate webhook deliveries do not create duplicate messages
- [ ] Same person messaging from WhatsApp phone and then email resolves to ONE Omni Identity (when Contact has both)
- [ ] New phone/email on an existing identity is auto-registered as alias
- [ ] New identity with similar name to existing one is flagged for review
- [ ] Merged identities are skipped during resolution

---

## Handbook Updates Required

- `technical_handbook.md`: Add implementation update entry for Phase 0 fixes; document the 8-step identity resolution chain
- `yet_to_improve.md`: Mark items 1, 2, 3, 14, 24 as resolved
- `psychological_handbook.md`: Add "single customer narrative" now has a concrete enforcement mechanism via multi-layer resolution
