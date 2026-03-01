# Excom Implementation Roadmap

Master index for all implementation phases. Derived from competitive analysis of Rocket.Chat (90+ feature modules), cross-referenced against Excom existing handbooks, gap documents, and ERPNext integration opportunities.

---

## Phase Overview

| Phase | Name | Effort | Priority | Status |
|---|---|---|---|---|
| 0 | Critical Fixes and Stabilization | 1-2 days | IMMEDIATE | COMPLETED |
| 1 | Schema, Validation, Backend Hardening | 5-8 days | HIGH | COMPLETED |
| 2 | Frontend Completion and Real-Time UX | 7-10 days | HIGH | COMPLETED |
| 3 | Omnichannel Expansion | 15-20 days | MEDIUM-HIGH | Partial (3.3, 3.5 done) |
| 3.5 | Pipeline, Teams, CRM Sync | 10-14 days | MEDIUM-HIGH | Not Started |
| 4 | Routing, Queues, SLA, Workflow | 12-15 days | MEDIUM | Not Started |
| 5 | AI Integration | 12-18 days | MEDIUM | Not Started |
| 6 | Deep ERPNext Integration | 10-14 days | MEDIUM | Not Started |
| 7 | Security, Permissions, Access Control | 8-12 days | HIGH | Not Started |
| 8 | Analytics, Reporting, Governance | 8-12 days | MEDIUM | Not Started |

Total estimated effort: 88-131 days

---

## Dependency Graph

Phase 0 (Critical Fixes) [DONE]
  -> Phase 1 (Backend Hardening) [DONE]
    -> Phase 2 (Frontend) [DONE] -> Phase 5 (AI)
    -> Phase 3 (Omnichannel) -> Phase 4 (Routing/SLA)
    -> Phase 3.5 (Pipeline/Teams/CRM) -> Phase 4 (builds on 3.5 teams + assignment)
    -> Phase 3.5 (Pipeline/Teams/CRM) -> Phase 6 (builds on 3.5 CRM sync)
    -> Phase 7 (Security) runs parallel with Phases 3-6
    -> Phase 6 (ERPNext) -> Phase 8 (Analytics)

---

## Files

- phase_0_critical_fixes.md - 3 critical bugs + webhook fixes
- phase_1_backend_hardening.md - Schema, validation, indexes, service layer, event bus
- phase_2_frontend_completion.md - Realtime, enrichment, attachments, AI stubs, mobile nav
- phase_3_omnichannel_expansion.md - Email, web chat, canned responses, tags, internal notes
- phase_3.5_pipeline_teams_crm.md - Pipeline stages, team management, assignment engine, CRM sync
- phase_4_routing_queues_sla.md - Departments, routing, queues, SLA, priorities, transfers
- phase_5_ai_integration.md - Profiling, suggestions, summaries, sentiment, translation
- phase_6_erpnext_integration.md - Lead auto-create, lifecycle, tickets, invoices, products
- phase_7_security_permissions.md - HMAC, rate limits, audit logs, RBAC, DLP, moderation
- phase_8_analytics_governance.md - Dashboards, agent metrics, CSAT, reports, alerts

---

## New DocTypes Across All Phases

| DocType | Phase | Purpose |
|---|---|---|
| Excom Canned Response | 3 | Pre-defined response templates |
| Excom Tag | 3 | Conversation categorization labels |
| Excom Thread Tag | 3 | Child table linking tags to threads |
| Excom Team | 3.5 | Team grouping for agents |
| Excom Team Member | 3.5 | Child table: user-team membership |
| Excom Assignment Log | 3.5 | Audit trail for thread assignments |
| Excom Department | 4 | Organizational units for routing |
| Excom Department Member | 4 | Agent-department assignments |
| Excom Routing Rule | 4 | Routing conditions and actions |
| Excom SLA Policy | 4 | Service level agreement definitions |
| Excom Priority | 4 | Weighted priority levels |
| Excom Business Hours | 4 | Work schedule definitions |
| Excom Work Hour | 4 | Day-by-day schedule child table |
| Excom Audit Log | 7 | Immutable event trail |
| Excom DLP Rule | 7 | Data loss prevention patterns |
| Excom CSAT Response | 8 | Customer satisfaction responses |

---

## Key Competitive Advantages Over Rocket.Chat

1. ERPNext Integration (Phase 6): Inline access to Leads, Opportunities, Invoices, Tickets, and full customer lifecycle within conversations.
2. AI with Business Context (Phase 5): AI suggestions powered by ERPNext data (deal stage, invoice status, ticket history).
3. Revenue Attribution (Phase 8): Track which conversations directly influenced sales.
4. Frappe-Native Permissions (Phase 7): Leverages ERPNext existing role and permission model.
5. Reuse-First Architecture: Extends existing ERPNext entities instead of duplicating them.

---

## Reference Documents

- technical_handbook.md - Architecture decisions and implementation log
- psychological_handbook.md - Design principles and anti-patterns
- whatsapp_handbook.md - WhatsApp API and integration guide
- yet_to_improve.md - 30-item audit of existing issues
- frontend_gaps_handbook.md - Frontend hardcoded values and gaps
