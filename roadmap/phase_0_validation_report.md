# Phase 0 Validation Report

**Date:** 2026-02-24  
**Scope:** Code inspection only (no code changes, no live testing)

---

## Checklist Results

| # | Item | Code Verification | Status |
|---|------|-------------------|--------|
| 1 | Bulk WhatsApp Message transitions to "In Progress" on submit | `on_submit` sets "Queued", then `create_single_message` calls `self.db_set("status", "In Progress")` when processing starts (`bulk_whatsapp_message.py:102`). Flow: Queued → In Progress. | ✅ **PASS** |
| 2 | Delayed WhatsApp notifications fire on schedule | When `enable_delay` is on and `notification_type` is "DocType Event", `send_template_message` creates a Pending `WhatsApp Notification Log` with `scheduled_for` instead of sending immediately. The scheduler processor picks these up and calls back with `force_send=True`. | ✅ **PASS** (fixed 2026-02-24) |
| 3 | DocType-event WhatsApp notifications fire | `doc_events` wires `run_server_script_for_doc_event` to validate, on_update, after_insert, on_submit, on_cancel, on_trash. `get_notifications_map()` maps (reference_doctype, doctype_event) → WhatsApp Notification; `send_template_message` is invoked for matching configs. | ✅ **PASS** |
| 4 | Webhook returns 200 immediately, processes in background | `post()` commits audit log, enqueues `_process_webhook_payload`, returns `Response("", status=200)` before processing (`webhook.py:71`). | ✅ **PASS** |
| 5 | Duplicate webhook deliveries do not create duplicate messages | `ingest_inbound_message` checks `provider_message_id` in Excom Message and returns early if exists (`thread_service.py:75-78`). | ✅ **PASS** |
| 6 | Same person messaging from WhatsApp phone and then email resolves to ONE Omni Identity (when Contact has both) | `resolve_identity` steps 6–7: ERPNext reverse lookup via Contact Phone and Contact Email. Contact linked to Omni Identity bridges both channels. | ✅ **PASS** |
| 7 | New phone/email on an existing identity is auto-registered as alias | Lines 269–296 in `omni_identity.py`: when phone/email differs from primary, appends to `aliases` with `source: "Auto"`. | ✅ **PASS** |
| 8 | New identity with similar name to existing one is flagged for review | `_find_potential_duplicate` sets `needs_review=1` and `potential_duplicate_of` (`omni_identity.py:323-330`). | ✅ **PASS** |
| 9 | Merged identities are skipped during resolution | All resolution steps filter `status != "Merged"` (steps 1, 2, 4, 5, 6, 7); step 3 checks `parent_status != "Merged"`. | ✅ **PASS** |

---

## Summary

- **9 of 9** items are implemented and verified.

---

## Recommendations

1. **Before Phase 2:** Run manual QA (create docs, trigger events, inspect DB) to confirm behaviour in your environment.

---

*Generated from code inspection. No live tests were run.*
