# Phase A: Security Essentials

Priority: HIGH
Estimated Effort: 3-5 days
Dependency: Phases 0-3 (complete)

---

## Objective

Lock down the basics before going live. No enterprise overkill — just the security you can't ship without.

---

## A.1 Webhook HMAC Validation

File: `excom/excom/channels/whatsapp/api.py`

- Validate `X-Hub-Signature-256` header against WhatsApp App Secret on every POST.
- Reject with 403 if signature is invalid.
- Store `app_secret` as encrypted Password field on Excom Channel Account.
- Return explicit 403 on GET when no matching verify_token found (instead of silent fallthrough).

Complexity: Low

---

## A.2 Input Sanitization

File: `excom/excom/api/chat.py`

- Sanitize message content with `frappe.utils.sanitize_html()` before storage.
- Validate max message length per channel (WhatsApp: 4096 chars).
- Validate required params, types, and string lengths on all `@frappe.whitelist()` endpoints.

Complexity: Low

---

## A.3 Basic Rate Limiting

- `send_message`: 30 req/min per user.
- `get_messages`: 120 req/min per user.
- Use `frappe.rate_limiter` decorator on critical endpoints.

Complexity: Low

---

## A.4 Role-Based Access (Frappe-Native)

Use Frappe's built-in permission system — no custom DocTypes needed.

### Roles

| Role | Access |
|---|---|
| Excom Agent | Read/write own assigned threads and messages |
| Excom Admin | Full access to all threads, settings, channel accounts |

### Implementation

- Add `has_permission()` override on Excom Thread controller: agents see only `assigned_to = frappe.session.user`.
- Add permission checks on `send_message`, `update_thread_status`, and settings APIs.
- Channel Account write access restricted to Excom Admin role.

Complexity: Medium

---

## A.5 Token Expiry Monitoring

- Daily scheduled job: check `token_expires_at` on all channel accounts.
- If token expires within 7 days, send Frappe notification to Excom Admin users.
- Log warning via `frappe.log_error()`.

Complexity: Low

---

## Validation Checklist

- [x] Webhook payloads rejected without valid HMAC signature
- [x] Invalid verify tokens return 403 (not silent)
- [x] Message content sanitized before storage
- [x] Rate limits enforced on send and query APIs
- [x] Agents see only their assigned threads (has_permission + permission_query_conditions)
- [x] Admins have full access
- [x] Channel account settings restricted to Admin (Excom Manager/System Manager only)
- [x] Token expiry alerts fire daily via check_token_expiry scheduled task

---

## What We're NOT Building Yet

These are deferred until actually needed:
- Audit log DocType (use Frappe's built-in Activity Log for now)
- DLP rules, content moderation, message flagging
- Supervisor role, department-level permissions
- Data export controls, retention policies
- Session tracking, concurrent login limits
