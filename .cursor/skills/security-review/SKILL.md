---
name: security-review
description: Security audit checklist — OWASP patterns, auth, injection, OAuth, webhook verification. Use when reviewing code for security issues or building auth flows.
---

# Security Review Checklist

## Authentication & Authorization
- [ ] All API endpoints use `@frappe.whitelist()`
- [ ] Permission checks: `frappe.has_permission()` before data access
- [ ] Guest endpoints (`allow_guest=True`) are genuinely public
- [ ] Token-based auth uses Frappe's built-in api_key/api_secret
- [ ] OAuth tokens encrypted at rest (Frappe Password field type)

## Injection Prevention
- [ ] No raw SQL — use Frappe ORM or parameterized queries
- [ ] User input sanitized before template rendering
- [ ] File uploads validated: type, size, extension
- [ ] No `eval()` or `exec()` on user-provided data

## OAuth & Token Security
- [ ] Refresh tokens never exposed to frontend
- [ ] Token refresh handled server-side with error recovery
- [ ] Expired tokens trigger re-auth flow, not silent failure
- [ ] OAuth state parameter validated against CSRF
- [ ] Scopes requested are minimum necessary

## Webhook Security
- [ ] WhatsApp: verify X-Hub-Signature-256 header
- [ ] Gmail: verify Pub/Sub message origin
- [ ] Instagram: verify hub.verify_token
- [ ] All webhook secrets from site_config.json, never hardcoded
- [ ] Webhook endpoints rate-limited

## Data Protection
- [ ] Message content never logged (log IDs only)
- [ ] PII not stored unnecessarily
- [ ] Database backups encrypted
- [ ] CORS restricted to specific origins

## Common Vulnerabilities
- [ ] No secrets in git (API keys, tokens, passwords)
- [ ] No `*` in CORS allowed origins
- [ ] No debug mode in production
- [ ] Error messages don't leak internal details to users
- [ ] File paths validated (no path traversal)
