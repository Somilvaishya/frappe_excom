# Phase 8: Analytics, Reporting, and Operational Governance

Priority: MEDIUM
Estimated Effort: 8-12 days
Dependency: Phase 4 (departments, SLA), Phase 7 (audit logs), Phase 6 (ERPNext integration)

---

## Objective

Build the measurement and governance layer that makes Excom an operationally mature platform. Real-time dashboards, historical analytics, agent performance tracking, and compliance reporting. This is Phase 7 of the technical_handbook build phases.

---

## 8.1 Real-Time Operational Dashboard

### What Rocket.Chat Has
analytics/dashboards.ts: real-time view of active conversations, queue sizes, agent status, wait times.

### Excom Implementation

#### 8.1.1 Dashboard API
Create excom.excom.api.analytics.get_dashboard():

Returns:
- active_conversations, queued_conversations
- avg_wait_time_seconds, avg_response_time_seconds
- agents_online, agents_busy
- conversations_today, messages_today
- sla_breaches_today, csat_score
- channel_breakdown (per-channel active/queued counts)

Data sources: Excom Thread, Excom Message, Frappe User sessions, SLA fields.

#### 8.1.2 Dashboard Frontend
Create ExcomDashboard.tsx page:
- Stat cards: active, queued, agents online, SLA breaches
- Channel breakdown bar chart
- Real-time updates via Socket.IO
- Agent status list (online/busy/offline with conversation count)

Complexity: High

---

## 8.2 Agent Performance Analytics

### What Rocket.Chat Has
LivechatAgentActivityMonitor.ts, analytics/agents.ts: per-agent metrics.

### 8.2.1 Agent Metrics API
excom.excom.api.analytics.get_agent_metrics(agent, date_range):

| Metric | Source | Description |
|---|---|---|
| Conversations handled | Thread assigned_to | Total in period |
| First response time | Message timestamps | Avg inbound-to-first-outbound |
| Resolution time | Thread created-to-closed | Avg open-to-close |
| Messages sent | Message direction=Outbound | Total outbound |
| SLA compliance | SLA fields on threads | Percent within SLA |
| Online time | Session or presence | Hours active |
| Transfer rate | Audit log transfers | Percent transferred away |

### 8.2.2 Agent Leaderboard
Rank by: resolution speed, CSAT, SLA compliance.
Filterable by department, channel, date range.

Complexity: Medium

---

## 8.3 Department Analytics

### 8.3.1 Department Metrics API
excom.excom.api.analytics.get_department_metrics(department, date_range):

| Metric | Description |
|---|---|
| Conversation volume | Total in period |
| Average queue time | Creation to first assignment |
| Average resolution time | Assignment to close |
| SLA breach count | Threads with breach |
| Channel distribution | Per-channel breakdown |
| Busiest hours | Hourly histogram |
| Agent utilization | Avg conversations per agent |

RC reference: analytics/departments.ts.

Complexity: Medium

---

## 8.4 Conversation Analytics

### 8.4.1 Volume Trends
Daily/weekly/monthly counts by channel. New vs returning contact ratio. Peak hours heatmap.

### 8.4.2 Message Type Distribution
Text vs media vs template vs system. Inbound vs outbound ratio. Avg messages per conversation.

### 8.4.3 Resolution Metrics
First Contact Resolution (FCR) rate. Average handle time. Reopen rate.

Complexity: Medium

---

## 8.5 ERPNext-Linked Business Analytics (Excom Differentiator)

What NO other communication platform offers:

### 8.5.1 Conversation-to-Revenue Attribution
Track conversations leading to Quotation/Sales Order creation.
Metric: "Conversations with linked Sales Orders worth total_amount."

### 8.5.2 Customer Segment Analysis
Group conversations by Customer Group, Territory.
Compare response times across segments.
Identify: "Premium customers wait 2x longer than standard."

### 8.5.3 Support Cost per Customer
Link conversation volume to customer revenue.
Calculate: conversations per dollar of revenue.
Identify high-maintenance accounts.

### 8.5.4 Lead Conversion Funnel
Track: Unknown -> Lead -> Opportunity -> Customer.
Show conversion rates at each stage. Attribute to channel and agent.

Complexity: High

---

## 8.6 CSAT (Customer Satisfaction) Surveys

### 8.6.1 Post-Conversation Survey
On thread close: send CSAT survey via active channel.
Question: "How would you rate your experience? 1-5 stars."
Optional: free-text feedback.

### 8.6.2 Excom CSAT Response DocType

| Field | Type | Purpose |
|---|---|---|
| thread | Link to Excom Thread | Conversation rated |
| omni_identity | Link to Omni Identity | Customer |
| rating | Int | 1-5 stars |
| feedback | Small Text | Optional text |
| agent | Link to User | Handling agent |
| channel | Link to Excom Channel | Channel used |
| department | Link to Excom Department | Department |

### 8.6.3 CSAT Dashboard
Overall score (rolling 30-day avg). Per-agent, per-department breakdown.
CSAT trend over time. Negative feedback highlights.

Complexity: Medium

---

## 8.7 Report Builder Integration

Leverage Frappe built-in report builder:
- "Excom Conversation Summary" (Script Report)
- "Excom Agent Performance" (Script Report)
- "Excom SLA Compliance" (Script Report)
- "Excom Channel Volume" (Script Report)
- Users can create custom Query Reports against Excom tables
- Export to CSV/Excel/PDF

Complexity: Medium

---

## 8.8 Compliance and Governance

### 8.8.1 Conversation Transcript Export
PDF/HTML transcripts with all messages, timestamps, agent names, system events.
Manual request or auto on thread close (configurable).
RC reference: ee/apps/omnichannel-transcript.

### 8.8.2 Data Retention Dashboard
Total records by DocType, oldest records, storage estimate.
Retention policy status, compliance status.

### 8.8.3 Scheduled Reports
Automated email reports:
- Daily: conversation summary, SLA breaches, unresolved queue
- Weekly: agent performance, department metrics
- Monthly: business analytics, CSAT trends, revenue attribution
Use Frappe Auto Email Report or custom scheduler.

Complexity: Medium

---

## 8.9 Monitoring and Alerting

### 8.9.1 Operational Alerts

| Alert | Condition | Recipients |
|---|---|---|
| Queue overflow | Queued > threshold | Supervisors, Admins |
| SLA breach imminent | Nearing SLA due time | Assigned agent, Supervisor |
| No agents online | Zero active sessions | Admins |
| Provider degraded | Health != Healthy | Admins |
| High error rate | >5% send failures/hour | Admins |
| Token expiry | Expires within 7 days | Admins |

### 8.9.2 Alert Channels
Frappe notification (bell), email, Excom thread to admin, WhatsApp to admin number (optional).

Complexity: Medium

---

## 8.10 Platform Statistics

System-wide stats for Admin:
- Total Omni Identities, Threads, Messages
- Messages per day (avg), active channels, active accounts
- Storage used, API calls today

Complexity: Low

---

## Validation Checklist

- [ ] Real-time dashboard loads with accurate metrics
- [ ] Agent performance metrics compute correctly
- [ ] Department analytics show volume and response times
- [ ] ERPNext revenue attribution links conversations to sales
- [ ] CSAT surveys send on thread close
- [ ] CSAT scores aggregate per agent, department, channel
- [ ] Script Reports accessible from Frappe report builder
- [ ] Conversation transcripts export to PDF
- [ ] Scheduled reports deliver on time
- [ ] Operational alerts trigger on threshold breach
