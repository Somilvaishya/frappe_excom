# Phase 7: Security Hardening, User Permissions, and Access Control

Priority: HIGH (runs in parallel with other phases where possible)
Estimated Effort: 8-12 days
Dependency: Phase 1 (service layer), Phase 4 (departments)

---

## Objective

Lock down Excom for enterprise deployment. Implement comprehensive security measures, granular role-based access control, and audit infrastructure that meets compliance requirements for handling customer communication data.

---

## 7.1 Webhook Security

### 7.1.1 HMAC Signature Validation (Critical)

File: Webhook handler in excom/excom/channels/whatsapp/api.py
Current Gap: POST handler trusts payload without verifying X-Hub-Signature-256 header.
Fix: Validate HMAC-SHA256 signature using the WhatsApp App Secret. Reject with 403 if invalid. Store app_secret per WhatsApp Account (new encrypted field).

Complexity: Medium

### 7.1.2 Webhook Verify Token Explicit Rejection

Current Gap: GET handler falls through silently when no account matches.
Fix: Return explicit 403 when no matching account found.

Complexity: Low

---

## 7.2 Input Sanitization and Validation

### 7.2.1 Message Content Sanitization
File: excom/excom/api/chat.py, send_message()
- Strip HTML tags (prevent XSS in admin views)
- Validate max length (WhatsApp: 4096 chars)
- Block known malicious patterns
- Use bleach or frappe.utils.sanitize_html()

### 7.2.2 API Input Validation
All whitelisted endpoints must validate: required params present, correct types, string lengths, reference existence.
Create excom/excom/utils/validators.py with reusable validation functions.

Complexity: Medium

---

## 7.3 Rate Limiting

### 7.3.1 Send API Rate Limiting
Per-user: max 30 messages/minute.
Per-account: respect WhatsApp Account rate_limit_per_second and rate_limit_per_day.
Return 429 Too Many Requests when exceeded.

### 7.3.2 API Rate Limiting
- get_threads: 60 req/min per user
- get_messages: 120 req/min per user
- send_message: 30 req/min per user
- Web chat widget APIs: 20 req/min per session

Use Frappe frappe.rate_limiter or Redis counter.

Complexity: Medium

---

## 7.4 Audit Logging

### 7.4.1 Excom Audit Log DocType

| Field | Type | Purpose |
|---|---|---|
| event_type | Select | message_sent / received / assigned / transferred / closed / viewed / exported / settings_changed |
| actor | Link to User | Who performed the action |
| actor_role | Data | Role at time of action |
| thread | Link to Excom Thread | Related thread |
| omni_identity | Link to Omni Identity | Related identity |
| details | Code (JSON) | Structured event details |
| ip_address | Data | Actor IP address |
| timestamp | Datetime | Event timestamp |

### 7.4.2 Events to Track

| Event | When | What to Log |
|---|---|---|
| Conversation Viewed | Agent opens thread | thread_id, agent |
| Message Sent | Outbound dispatched | thread_id, channel, to, type |
| Thread Assigned | Agent assigned | thread_id, old/new agent, method |
| Thread Transferred | Conversation transferred | thread_id, from/to, comment |
| Thread Closed | Resolved | thread_id, agent, resolution_time |
| Data Exported | Data exported | thread_ids, format, requester |
| Settings Changed | Config modified | field, old/new value |
| Contact Merged | Identities merged | source_id, master_id |
| Bulk Message Sent | Bulk initiated | template, recipient_count |

### 7.4.3 Retention
Configurable period (default 365 days). Archive to file before deletion.

RC reference: IAuditLog with search criteria, user, timestamp, results count.

Complexity: Medium

---

## 7.5 Role-Based Access Control

### 7.5.1 Custom Roles

| Role | Access Level | Description |
|---|---|---|
| Excom Agent | Own conversations | View/respond assigned threads, use canned responses |
| Excom Supervisor | Department conversations | View all dept threads, transfer, reassign |
| Excom Admin | All conversations | Full access: settings, rules, SLA, departments |
| Excom Viewer | Read-only | View conversations and reports, no modify |

### 7.5.2 Permission Rules

Thread Access:
- Agent: read/write only threads where assigned_to = current_user
- Supervisor: read all dept threads, can reassign/transfer/close
- Admin: full CRUD on all threads
- Implementation: custom has_permission on Excom Thread controller

Message Access:
- Inherit thread permissions. Internal notes visible only to agents/supervisors.

Settings Access:
- Only Admin can modify Settings, Routing Rules, SLA, Departments, Business Hours
- Supervisor: read-only settings, manage department members

Channel Account Access:
- Control which agents can send from which accounts
- Permission matrix or child table on Excom Channel Account

### 7.5.3 API Permission Guards
Every whitelisted endpoint checks thread.has_permission("write") before executing.

RC reference: authorization module with 100+ granular permissions.

Complexity: High

---

## 7.6 Data Protection

### 7.6.1 Credential Encryption
All tokens/passwords in Frappe Password field (encrypted at rest). Mask in logs (show only last 4 chars).

### 7.6.2 Token Rotation and Expiry Alerts
Track token_expires_at on WhatsApp Account. Daily job: check tokens expiring within 7 days, notify Admins.

### 7.6.3 Data Loss Prevention (DLP)

Excom DLP Rule DocType:

| Field | Type | Purpose |
|---|---|---|
| rule_name | Data | Rule label |
| pattern | Data | Regex to detect (credit card, PII patterns) |
| action | Select | Block / Warn / Log |
| applies_to | Select | Outbound / Inbound / Both |
| is_enabled | Check | Active toggle |

### 7.6.4 Message Retention Policies
Configurable per channel/department. Auto-archive or delete messages older than N days. Export before deletion. Similar to RC retention-policy module.

Complexity: Medium

---

## 7.7 Content Moderation

### 7.7.1 Report/Flag Messages
Agents flag messages as inappropriate/spam. Reviewed by Supervisor/Admin.
Fields on Excom Message: reported_by, report_reason, report_status.

RC reference: IModerationReport.

### 7.7.2 Contact Blocking
is_blocked field on Omni Identity. Blocked contacts messages logged but not routed.

Complexity: Low

---

## 7.8 Session and Access Management

### 7.8.1 Agent Session Tracking
Track active agents using Frappe sessions + realtime presence.
Admin panel: agent name, last active, current thread count.

### 7.8.2 Concurrent Session Limits
Configurable max sessions per role. Prevent credential sharing.

RC reference: ISession, IUserSession.

Complexity: Low

---

## 7.9 ERPNext Permission Alignment

### 7.9.1 Linked Entity Visibility
Backend checks user permission on linked DocType before returning to frontend.
Filter out entities agent cannot access.

### 7.9.2 Cross-Module Permission Sync
CRM Lead assignment auto-assigns Excom thread. Helpdesk ticket assignment shows in Excom queue.

Complexity: Medium

---

## 7.10 Data Export Controls

### 7.10.1 Export Permissions
Only Admin and Supervisor can export. Formats: CSV, JSON, PDF transcript. All exports logged.

### 7.10.2 Export Scope Limits
Supervisors: own department only. Admins: all data. Date range required.

Complexity: Medium

---

## Validation Checklist

- [ ] Webhook payloads validated with HMAC signature
- [ ] Invalid verify tokens return 403
- [ ] Message content sanitized before storage
- [ ] Rate limits enforced on send and query APIs
- [ ] Audit log records all conversation access and actions
- [ ] Agents see only assigned threads
- [ ] Supervisors see department threads
- [ ] API endpoints check permissions before executing
- [ ] DLP rules block credit card patterns in outbound
- [ ] Token expiry alerts sent 7 days before expiration
- [ ] Linked ERP entities filtered by user permissions
- [ ] Data exports logged and permission-gated
