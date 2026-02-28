# Phase 6: Deep ERPNext Integration — Excom's Competitive Edge

Priority: MEDIUM
Estimated Effort: 10-14 days
Dependency: Phase 1 (event bus), Phase 3 (multi-channel), Phase 4 (departments)

---

## Objective

This is where Excom becomes fundamentally superior to Rocket.Chat, Chatwoot, and every standalone communication tool. By deeply integrating with ERPNext's business entities, Excom gives agents instant business context that no other platform can match. Every conversation becomes a window into the full customer lifecycle.

---

## 6.1 Auto-Create Lead/Opportunity from Conversation

### The Gap
When a new unknown contact messages, agents must manually go to CRM and create a Lead. This breaks flow and loses context.

### Implementation

#### 6.1.1 Auto-Lead Creation
In `thread_service.ingest_inbound_message()`, after Omni Identity resolution:
1. Check if Omni Identity has any linked Lead or Contact.
2. If no linked entity exists AND CRM app is installed:
   - Auto-create `Lead` with: `lead_name` from Omni Identity `display_name`, `mobile_no` from `primary_phone`, `email_id` from `primary_email`, `source` = "Excom - {channel}".
   - Create `Omni Identity Link` to the new Lead.
3. Configurable: toggle auto-creation in `Excom Settings`.

#### 6.1.2 One-Click Opportunity Creation
Add "Create Opportunity" button in `OmniIdentityPanel.tsx`:
- Pre-fills: `party_type` = Lead, `party_name` from linked Lead, `source` = conversation channel.
- Opens Frappe form in new tab (or slide-over panel).
- On save, auto-link Opportunity to Omni Identity.

- **Complexity:** Medium

---

## 6.2 Customer Lifecycle Tracking

### The Vision
Show the complete business journey inline in the conversation sidebar:
```
Lead -> Opportunity -> Quotation -> Sales Order -> Customer
```

### Implementation

#### 6.2.1 Lifecycle Timeline Component
Create `ERPLifecycleTimeline.tsx` for `OmniIdentityPanel.tsx`:
- Query all linked entities from Omni Identity.
- For each entity, show: doctype icon, title, status, date, amount (if applicable).
- Sort chronologically.
- Example display:
  ```
  Lead: Acme Corp (Open) — Feb 10
  Opportunity: Enterprise Plan ($50k) — Feb 15
  Quotation: QTN-00123 (Submitted) — Feb 20
  ```

#### 6.2.2 Backend API
`excom.excom.api.erp.get_lifecycle(omni_identity)`:
- Traverse linked entities: Lead -> Opportunity -> Quotation -> Sales Order -> Customer.
- For each, return: `{doctype, name, title, status, creation, grand_total}`.
- Follow ERPNext's party linkage chain (Lead.name -> Opportunity.party_name, etc.).

- **Complexity:** Medium

---

## 6.3 Support Ticket Bi-Directional Sync

### From technical_handbook.md
"Allow conversation-to-ticket linking without message duplication. Push key events to ticket timeline."

### Implementation

#### 6.3.1 Create Ticket from Conversation
Add "Create Ticket" button in `ChannelTabsView.tsx` header:
- Pre-fills: `subject` from AI conversation summary (Phase 5) or first message, `raised_by` from contact email, `description` from last N messages.
- Creates `HD Ticket` (if Helpdesk installed) or `Issue` (if not).
- Links ticket to Omni Identity.

#### 6.3.2 Ticket Status in Chat Timeline
When a linked ticket's status changes:
- Insert system message in thread: "Ticket #ISSUE-00123 status changed to Resolved."
- Hook: `doc_events` on `HD Ticket` / `Issue` that checks for linked Omni Identity and publishes to thread.

#### 6.3.3 Reply-to-Ticket from Chat
Agent can reply to a ticket directly from the chat interface:
- Show ticket details in sidebar.
- "Reply to Ticket" inserts response as a ticket comment AND sends to customer via active channel.

- **Complexity:** High

---

## 6.4 Invoice and Payment Context

### The Problem
Customer messages "Where is my invoice?" and the agent has to open a separate browser tab to check.

### Implementation

#### 6.4.1 Outstanding Invoices in Sidebar
When a conversation opens with a linked Customer:
- Query `Sales Invoice` where `customer = {customer}` and `outstanding_amount > 0`.
- Show in `OmniIdentityPanel.tsx`: invoice number, date, outstanding amount, due date.
- Color-code: green (not due), yellow (due soon), red (overdue).

#### 6.4.2 Payment Status Alerts
When `Payment Entry` is submitted for a linked Customer:
- Insert system message: "Payment of {amount} received against Invoice {name}."
- Useful for: "Did you receive my payment?" queries.

#### 6.4.3 Send Invoice via Chat
"Share Invoice" button on each invoice card:
- Attach PDF print of Sales Invoice to the conversation.
- Send via active channel (WhatsApp document message, email attachment).

- **Complexity:** Medium

---

## 6.5 Product Catalog in Chat

### Implementation

#### 6.5.1 Item Search
Add `/item` slash command or search button in message composer:
- Search ERPNext Items by name, item_code, or barcode.
- Show: item name, image, price (from default price list), stock availability.

#### 6.5.2 Share Item Card
Send a formatted item card to the customer:
- For WhatsApp: interactive message with image, name, price, and "View Details" button.
- For email: HTML card with item details.
- For web chat: rich card component.

- **Complexity:** Medium

---

## 6.6 Appointment and Event Scheduling

### Implementation

#### 6.6.1 Schedule from Chat
"Schedule Meeting" button in `OmniIdentityPanel.tsx`:
- Opens `Event` creation form pre-filled with:
  - `subject` = "Meeting with {contact_name}"
  - `event_participants` linked to Contact
  - `starts_on` and `ends_on` from agent selection
- Optionally send calendar invite to customer via email.

#### 6.6.2 Upcoming Events Display
Show upcoming Events linked to this Contact in the sidebar:
- Date, time, subject, participants.
- "Join" button if virtual meeting link exists.

- **Complexity:** Low-Medium

---

## 6.7 Document Print Attachment

### From whatsapp_handbook.md
WhatsApp Notification already supports `attach_document_print` with `print_format` override.

### Implementation

#### 6.7.1 Share Any Document Print
Add "Share Document" action in `OmniIdentityPanel.tsx`:
- Search any linked ERPNext document (Quotation, Sales Order, Delivery Note, Invoice).
- Generate PDF using Frappe's print format system.
- Attach to message and send via active channel.

#### 6.7.2 Quick Share Buttons
On each linked ERP entity card, add a "Share" icon:
- One-click: generate PDF and send in current conversation.
- Confirm dialog: "Send Quotation QTN-00123 PDF to +91XXXXXXXXXX via WhatsApp?"

- **Complexity:** Medium

---

## 6.8 Customer Credit Limit Alerts

### Implementation
When a conversation opens with a linked Customer:
- Check `Customer.credit_limit` vs total outstanding.
- If outstanding > 80% of credit limit: show warning badge.
- If exceeded: show red alert "Credit limit exceeded by {amount}."
- Agent awareness prevents accepting orders that will be blocked downstream.

- **Complexity:** Low

---

## 6.9 Workflow State Notifications

### Implementation
Hook into ERPNext document workflow state changes:
- When a document linked to a contact changes state (e.g., "Sales Order Approved", "Issue Resolved"):
- Insert system message in the relevant thread.
- Optionally notify the customer via active channel (configurable per workflow transition).

Use `doc_events` hooks on key ERPNext DocTypes:
- `Sales Order` (on_submit, on_cancel)
- `Delivery Note` (on_submit)
- `Sales Invoice` (on_submit)
- `Payment Entry` (on_submit)
- `Issue` / `HD Ticket` (on status change)

- **Complexity:** Medium

---

## 6.10 Custom Field Mapping

### Implementation
Allow admins to map ERPNext custom fields to conversation metadata:
- `Excom Field Mapping` DocType:
  - `source_doctype`, `source_field`, `target_usage` (Filter / Display / Route)
- Example: map `Customer.territory` to a routing condition, or `Lead.industry` to a display field in the sidebar.
- Enables industry-specific customization without code changes.

- **Complexity:** Medium

---

## Validation Checklist

- [ ] New unknown contacts auto-create Leads (when enabled)
- [ ] Customer lifecycle timeline displays in sidebar
- [ ] Tickets created from conversation with pre-filled context
- [ ] Ticket status changes appear as system messages in chat
- [ ] Outstanding invoices visible in sidebar with color coding
- [ ] Items searchable and shareable via chat
- [ ] Events created from chat with correct participant linkage
- [ ] Document PDFs attachable and sendable in one click
- [ ] Credit limit warnings display for relevant customers
- [ ] Workflow state changes push to conversation timeline

---

## Handbook Updates Required

- `technical_handbook.md`: Document ERPNext integration services, hook registrations, API endpoints
- `psychological_handbook.md`: Add note on "single pane of glass" operational philosophy
