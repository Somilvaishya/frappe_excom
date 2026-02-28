# Phase 4: Routing, Queues, SLA, and Workflow Automation

Priority: MEDIUM
Estimated Effort: 12-15 days
Dependency: Phase 3 (multi-channel), Phase 1 (service layer)

---

## Objective

Build the operational backbone: intelligent routing, queue management, SLA enforcement, departments, transfers, and workload balancing.

---

## 4.1 Department System

### Excom Department DocType
- department_name (Data), description, is_enabled (Check)
- channels (Table MultiSelect to Excom Channel)
- fallback_department (Self Link), max_concurrent_chats (Int)
- business_hours (Link to Excom Business Hours)
- members (Table of Excom Department Member: user, role, is_active)

RC reference: ILivechatDepartment with agents, fallback, business hours, analytics.

Complexity: Medium

---

## 4.2 Routing Engine

### 4.2.1 Routing Manager Service
Create `excom/excom/services/routing_service.py`:
- get_next_agent(department, channel, priority)
- Strategies: Round Robin, Least Load, Manual Queue, Skills-Based (future)

### 4.2.2 Excom Routing Rule DocType
- rule_name, channel (Link), conditions (JSON Code)
- action (Select: Assign Dept / User / Tag / Priority)
- target_department, target_user, priority (Int), is_enabled

Rules evaluate in priority order. First match wins.

### 4.2.3 Auto-Assignment on Inbound
In thread_service.ingest_inbound_message():
1. If thread has no assigned_to, evaluate routing rules
2. Determine target department
3. Call routing_service.get_next_agent()
4. Set assigned_to, publish excom:thread_assigned event

Complexity: High

---

## 4.3 Queue Management

### 4.3.1 Queue Model
Use Excom Thread status = "Queued" (no new DocType).
Flow: New -> Queued -> Open -> Pending -> Closed

### 4.3.2 Queue View
LeftSidebar.tsx "Queue" section: unassigned threads sorted by priority then wait time.
"Accept" button to self-assign. Queue count badge.

### 4.3.3 Auto-Transfer Unanswered
Background job: if Open thread has no response for N minutes, transfer or return to queue.

Complexity: Medium

---

## 4.4 SLA Policies

### Excom SLA Policy DocType
- sla_name, first_response_time (Int minutes), resolution_time (Int minutes)
- applies_to_channels, applies_to_departments (Table MultiSelect)
- priority_boost (Int)

### SLA Fields on Excom Thread
- sla_policy (Link), sla_first_response_due, sla_resolution_due
- sla_first_response_met, sla_resolution_met, sla_breached (Check fields)

### SLA Timer Job
Cron every 1 minute: check threads past SLA due, mark breached, escalate.

RC reference: IOmnichannelServiceLevelAgreements with dueTimeInMinutes.

Complexity: High

---

## 4.5 Priority System

### Excom Priority DocType
- priority_name, weight (Int, lower = higher), color (Color)
- Seed: Urgent(1), High(2), Normal(3), Low(4)
- Change Excom Thread priority to Link instead of free-text
- Queue sorts by weight then last_message_at

RC reference: ILivechatPriority with LivechatPriorityWeight enum.

Complexity: Medium

---

## 4.6 Business Hours

### Excom Business Hours DocType
- schedule_name, timezone, is_default
- work_hours (Table of Excom Work Hour: day, is_open, start_time, end_time)

Behavior: Outside hours, queue instead of auto-assign. Offline form in widget. Department overrides.

RC reference: ILivechatBusinessHour with Single/Custom types, timezone support.

Complexity: Medium

---

## 4.7 Conversation Transfer

### Transfer Service
`excom/excom/services/transfer_service.py`:
- transfer_to_agent(), transfer_to_department(), return_to_queue()
- Each: update assigned_to, create system message, publish realtime, increment hop count

### Transfer UI
Transfer button in header, modal for target selection + comment.

RC reference: TransferData with scope, comment, hops, fallback dept.

Complexity: Medium

---

## 4.8 Escalation Engine

Triggered by SLA breach, manual button, or routing rule.
Actions: notify supervisor, reassign, boost priority. Log as system message.

Complexity: Medium

---

## Validation Checklist

- [ ] Auto-assignment works via routing rules
- [ ] Queue shows unassigned threads sorted correctly
- [ ] SLA timers track and breach correctly
- [ ] Transfers work between agents, departments, and queue
- [ ] Business hours control availability
- [ ] Escalation fires on SLA breach
