# Excom Psychological Handbook

## Why Excom Exists

Teams lose customer context when communication is split across tools.
Excom exists to restore context continuity by making every external conversation visible, traceable, and actionable in one place.

## Product Intent

Excom is not just a chat UI.
It is an operating system for external communication workflows, built on Frappe, with operational discipline similar to enterprise support and communication products.

## Principles We Will Not Compromise

1. Single customer narrative over fragmented channel logs.
2. Operational clarity over feature density.
3. Auditability over hidden automations.
4. Reliable delivery semantics over fast but unsafe hacks.
5. Reversible design decisions over deep early lock-in.

## Architecture Psychology

### Keep Core Stable, Keep Edges Flexible

- Channel connectors change often; core conversation model should not.
- Provider-specific behavior stays in adapters, never leaks into domain language.

### Prefer Explicit Flows Over Magic

- Routing and automation should be explainable.
- Operators and admins must understand why a conversation was assigned or escalated.

### Build Trust Through Determinism

- The same input should produce the same routing outcome.
- Every state change must have a timestamped cause.
- AI profile outputs must be explainable and tied to a known data window.

### Productive Defaults, Strict Overrides

- Provide sane defaults for queues, SLAs, and templates.
- Allow advanced configuration but avoid turning every screen into a rule engine.

## Anti-Patterns to Avoid

- Mixing provider payload shape directly into business logic.
- Creating generic abstractions before at least two real use-cases demand them.
- Putting heavy logic in Doctype controllers.
- Building analytics from mutable message rows instead of event trails.
- Solving assignment fairness in UI only; it must be system-level.

## Decision Filters

Before implementing a feature, ask:

1. Does this improve operator response quality or speed?
2. Does this preserve a unified customer timeline?
3. Can this be audited later without ambiguity?
4. Can this fail safely without losing messages?
5. Does this align with Frappe-native maintainability?

If the answer to any is no, redesign before shipping.

## UX Psychology for Operators

- Inbox should reduce cognitive load, not increase it.
- Every action should answer: what changed, why it changed, what to do next.
- Status and ownership must be obvious at a glance.
- Internal notes and customer-facing messages must be impossible to confuse.
- CRM and Helpdesk context should appear inline so agents do not switch tools for basic triage.

## Team Working Norms

- Prefer simple and modular service design.
- Write docs with code changes; handbook drift is treated as a defect.
- Add tests when logic has branching, timing, or retry complexity.
- Avoid optimism bias around connector reliability; design for outages.
- Reuse existing DocTypes before creating new ones; new schema is a last resort.
- Treat AI-generated contact profile text as draft intelligence; human operators retain final judgment.
- Keep foundational registries system-managed to prevent accidental desk-level drift.

## Current Strategic Position

This phase is research and framing.
The immediate objective is to establish a coherent architecture and language before implementing connectors and workflows.

## Change Log

### 2026-02-20

- Added initial psychological frame for Excom.
- Captured non-negotiable principles, anti-patterns, and decision filters.
- Defined product and architecture intent for the upcoming implementation phases.
- Aligned architecture mindset to a reuse-first DocType strategy.
- Added CRM/Helpdesk compatibility intent and per-contact AI profile direction.
- Added first implementation decision: `Excom Channel` is system-managed and seeded via patch.
- Added WhatsApp notification execution principle: queue first for delayed workflows, then re-validate document state at dispatch time.
- Established `WhatsApp Notification Log` as both operational queue and audit trail to preserve explainability of delayed sends.
- Added cancellation safety expectation: delayed notifications must not send if source documents are cancelled or deleted.

### 2026-02-24

- Complete UI overhaul: replaced 2-panel WhatsApp-clone layout with 4-panel omnichannel dashboard.
- New design system: zinc-based dark theme with blue-purple gradient accents, shadcn/ui component library.
- Omni Identity panel makes cross-channel contact context immediately visible to operators.
- AI Assistant drawer introduces AI-assisted communication without replacing human judgment.
- Channel tabs with account switching reflect the product principle of one conversation timeline across channels.
- Mobile experience ensures operators can respond from any device without losing context.
- Architectural intent: UI now matches the backend's omnichannel ambition (Omni Identity, Excom Thread, Channel Accounts).

### 2026-02-24 — Phase 2: Frontend Completion

- **Reduce cognitive load**: Realtime updates eliminate the mental overhead of "is this data current?" — operators see messages appear instantly without refreshing.
- **Contact enrichment** populates the identity panel with real data (avatar, email, company). Operators no longer need to context-switch to ERP to understand who they're talking to.
- **File attachments** bridge the gap between "chat tool" and "work tool" — operators can send documents, images, and media without leaving the conversation.
- **AI suggestions from real data** (not hardcoded) establish the pattern for LLM integration. Even the stub creates value: recent outbound messages as reply templates, ERP-linked action items.
- **Quick actions** (View in ERPNext, Send Email, Schedule Meeting, Take Over) directly connect communication to business workflow. This is the core product thesis: communication is not separate from work.
- **Account switching fix** ensures that the conversation timeline follows the account, not the UI state. The principle: data determines view, not the other way around.
- **Optimistic send** creates the perception of speed even when the backend is processing. Error recovery restores the message to input, preserving the operator's work.
- **Mobile contacts and calls tabs** complete the bottom navigation. "Coming Soon" for calls is honest about scope while establishing the navigation pattern.

### 2026-03-28 — Mobile OAuth public origin

- Operators expect the "site URL" shown for mobile login to match what they type in a browser (HTTPS on the public hostname). Showing an internal bench port erodes trust and breaks OAuth on real devices.
- Preference order: honor explicit admin override, then the same mental model of "public hostname" Frappe uses, without silently tacking on the dev server port.

### 2026-03-28 — Push relay discovery

- Frappe's relay is a **different** deployment than the ERP site; conflating `push_relay_server_url` with "our site URL" produces confusing 417 errors, not a product bug in Excom.
- First-time relay registration (API key/secret in Push Notification Settings) should happen in line with Frappe's server-side flow; the UI should not depend on the browser successfully guessing the relay host.

