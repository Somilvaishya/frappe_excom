# Excom Implementation Roadmap

Phases 0-3 built the working product — WhatsApp, Email, Instagram channels, real-time inbox, Omni Identity, and basic frontend. The remaining work is deliberately minimal: ship security, add AI, then grow based on real usage.

---

## Phase Overview

| Phase | Name | Effort | Status |
|---|---|---|---|
| ~~0~~ | ~~Critical Fixes and Stabilization~~ | ~~1-2 days~~ | DONE |
| ~~1~~ | ~~Schema, Validation, Backend Hardening~~ | ~~5-8 days~~ | DONE |
| ~~2~~ | ~~Frontend Completion and Real-Time UX~~ | ~~7-10 days~~ | DONE |
| ~~3~~ | ~~Omnichannel Expansion~~ | ~~15-20 days~~ | DONE (MVP) |
| **A** | **Security Essentials** | **3-5 days** | DONE |
| **B** | **AI Intelligence Layer** | **5-8 days** | Not Started |

Remaining effort: ~8-13 days

---

## Phase A: Security Essentials (3-5 days)

Ship-blocking security — the minimum you can't go live without.

- HMAC webhook signature validation (WhatsApp)
- Input sanitization on all APIs
- Basic rate limiting on send/query endpoints
- Role-based access: Agent (own threads) vs Admin (everything)
- Token expiry monitoring alerts

**No enterprise bloat.** No DLP, no audit log DocType, no supervisor roles, no session tracking. Add when needed.

---

## Phase B: AI Intelligence Layer (5-8 days)

Replace hardcoded AI stubs with real intelligence. Three features, one LLM client.

- **LLM Client:** Single function calling OpenAI-compatible API (works with OpenAI + Ollama)
- **Suggested Replies:** 3 contextual reply suggestions per conversation (replaces hardcoded stubs)
- **Conversation Summary:** Auto-generated on thread close, on-demand refresh
- **Contact Profiling:** Behavioral summary from conversation history + ERP context

**No over-abstraction.** No provider factory, no sentiment analysis, no auto-translation, no AI routing. Add when agents ask for it.

---

## Philosophy: Add Based on Need

These features exist in the old detailed specs but are **intentionally deferred**. Build them only when real usage demands it:

| Feature | Build When... |
|---|---|
| Teams + Assignment Engine | You have 3+ agents and need workload distribution |
| Pipeline / Kanban | Sales team needs visual funnel tracking |
| CRM Sync | You're actively using Frappe CRM alongside Excom |
| Routing Rules + SLA | You have multiple departments with different response targets |
| Deep ERPNext Integration | Agents frequently context-switch to ERPNext for invoice/ticket info |
| Analytics Dashboard | Management needs operational metrics |
| Sentiment Analysis | You want AI to flag frustrated customers |
| Auto-Translation | You serve customers in multiple languages |
| CSAT Surveys | You need customer satisfaction measurement |
| Audit Logging | Compliance requires immutable event trails |

---

## Files

- `phase_A_security_essentials.md` — Webhook HMAC, sanitization, rate limits, RBAC, token monitoring
- `phase_B_ai_layer.md` — LLM client, suggested replies, conversation summary, contact profiling

---

## Reference Documents

- `technical_handbook.md` — Architecture decisions and implementation log
- `psychological_handbook.md` — Design principles and anti-patterns
- `whatsapp_handbook.md` — WhatsApp API and integration guide
