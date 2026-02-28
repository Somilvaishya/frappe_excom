# Phase 2: Frontend Completion and Real-Time UX

Priority: HIGH
Estimated Effort: 7-10 days
Dependency: Phase 0 and Phase 1 (event bus, service layer)

---

## Objective

Wire up every non-functional UI element, replace all hardcoded data with live API calls, implement file attachments, and add realtime updates via Socket.IO. After this phase, the frontend is a functional communication tool, not a design prototype.

---

## 2.1 Realtime Message Updates (Replace Polling)

### Current State
- Chat polls every 5 seconds for new messages and 10 seconds for contact list refresh.

### Target
- Use Frappe's Socket.IO realtime system.
- Backend: `frappe.publish_realtime("excom:message_received", ...)` from webhook handler (added in Phase 1).
- Frontend: `useFrappeEventListener` hook to subscribe to events.

### Implementation
- Create `useRealtimeMessages(threadId)` hook that listens for `excom:message_received` and appends new messages to local state.
- Create `useRealtimeThreads()` hook that listens for `excom:thread_updated` and updates thread list ordering/unread counts.
- Add typing indicator support: publish `excom:typing` event from send input, subscribe in conversation view.

- **Complexity:** Medium

---

## 2.2 Contact Data Enrichment

### Current Hardcoded Values (useContacts.ts)

| Field | Current | Source |
|---|---|---|
| `contactAvatar` | Always `""` | Omni Identity or Contact image field |
| `contactInfo.email` | Always `""` | Omni Identity `primary_email` |
| `contactInfo.company` | Always `""` | Linked Contact/Lead company field |
| `status` | Always `"offline"` | `last_seen` from Omni Identity Channel or realtime presence |
| `aiStatus` | Always `undefined` | Thread or AI service state |
| `assignedTo.avatar` | Always `""` | User image for assigned agent |

### Backend API Changes
- Extend `get_threads` API to return: `primary_email`, `company`, `avatar_url`, `assigned_to_avatar`, `last_seen`
- OR create a dedicated `get_contact_enrichment(omni_identity)` endpoint to avoid bloating the thread list query.

- **Complexity:** Medium

---

## 2.3 File Attachment Support

### Paperclip / Image Buttons (Desktop + Mobile)

Both `ChannelTabsView.tsx` and `MobileChannelView.tsx` have non-functional attachment buttons.

### Implementation
1. **File Picker**: Use `<input type="file">` triggered by paperclip button click.
2. **Upload**: Use Frappe's file upload API (`/api/method/upload_file`).
3. **Send**: Call `send_message` API with `message_type: "media"` and the uploaded file reference.
4. **Display**: Render image/document/video/audio messages in the message list with appropriate previews.
5. **Supported types**: image (jpg, png, gif, webp), document (pdf, doc, xls), video (mp4), audio (ogg, mp3).
6. **Drag and drop**: Add `FilesDropTarget` wrapper component for the message area.

### Backend
- `send_message` API must support `media_url` parameter.
- WhatsApp service must handle media upload to Meta's API before sending.

- **Complexity:** High

---

## 2.4 AI Assistant — Replace Hardcoded Data

### AIAssistantDrawer.tsx and MobileAIDrawer.tsx

All AI data is currently static. This phase creates the API contract even if the AI backend is a stub.

### Backend API
Create `excom.excom.api.ai.get_ai_suggestions(thread_id)` that returns:

```json
{
  "suggested_replies": [{"text": "...", "confidence": 0.9}],
  "summary": {"text": "...", "updated_at": "...", "sentiment": "positive"},
  "next_actions": [{"action": "...", "priority": "high", "due": "..."}],
  "insights": {
    "response_pattern": "...",
    "engagement_rate": 0.95,
    "best_contact_time": "..."
  }
}
```

Phase 2 implementation: return computed values from message history (no LLM yet):
- `suggested_replies`: Last 3 canned responses used for this contact type (stub)
- `summary`: Message count + last activity timestamp
- `next_actions`: Based on linked ERP entity status
- `insights`: Computed from actual message timestamps

Full AI integration deferred to Phase 5.

- **Complexity:** Medium

### Wire Up Buttons
- "Generate More Suggestions" -> call API with `force_refresh=True`
- Suggested reply click -> insert into message input (pass via callback)
- "Start" on actions -> open relevant Frappe form or create task

---

## 2.5 Quick Action Buttons

### OmniIdentityPanel.tsx and MobileContactView.tsx

| Button | Implementation |
|---|---|
| "View in ERPNext" | Open first linked entity's form in new tab (`/app/{doctype}/{name}`) |
| "Send Email" | Open Frappe email dialog: `new frappe.views.CommunicationComposer(...)` or `window.open(mailto:...)` |
| "Schedule Meeting" | Open new Event form: `/app/event/new?party_type=Contact&party={name}` |

- **Complexity:** Low

### ChannelTabsView.tsx

| Button | Implementation |
|---|---|
| "Take Over" | Call API to set `assigned_to` on thread to current user, update AI status |
| Attachment buttons | Covered in 2.3 |

- **Complexity:** Low-Medium

---

## 2.6 Mobile Navigation Completion

### Bottom Tab Bar

| Tab | Current | Implementation |
|---|---|---|
| Chats | Functional | No change |
| Calls | Nothing | Show call history (list of past conversations with voice/call type). Phase 2: show empty state with "Coming Soon." |
| Contacts | Nothing | Show all Omni Identities as a searchable contact list. Create `MobileContactsList.tsx` component. |

### MobileApp.tsx
- Add view routing for "contacts" and "calls" views.
- "Calls" view: placeholder until VOIP integration (Phase future).
- "Contacts" view: list all Omni Identities with search, tap to open `MobileContactView`.

- **Complexity:** Medium

---

## 2.7 Account Switching

### OmniIdentityPanel.tsx

Account cards support click-to-switch but messages don't refresh for the new account thread.

### Fix
- When an account card is clicked, find the corresponding `ExcomThread.name` for that `(omni_identity, channel, account)`.
- Update `selectedAccountId` to this thread's name.
- `useMessages` will re-fetch for the new thread.
- Highlight the active account card.

- **Complexity:** Low

---

## 2.8 Response Time Calculation

### OmniIdentityPanel.tsx and MobileContactView.tsx

"Response time" is hardcoded to "~5 min" / "~5m".

### Implementation
- Create `get_response_metrics(omni_identity)` API.
- Calculate average reply time from Excom Message records: time between last inbound and next outbound per thread.
- Return `avg_response_time_seconds`.
- Frontend: format as "~Xm" or "~Xh" depending on magnitude.

- **Complexity:** Low

---

## 2.9 Message Input UX Polish

- **Optimistic Send**: Append message to local state immediately on send, show "sending" indicator, update to "sent" on API success.
- **Error Recovery**: On send failure, show error toast and restore message in input field (partially done).
- **Enter to Send / Shift+Enter for Newline**: Ensure consistent behavior across desktop and mobile.
- **Message Character Limit**: Show character count approaching WhatsApp's 4096 limit.

- **Complexity:** Low

---

## Validation Checklist

- [ ] New messages appear instantly without page refresh
- [ ] Thread list reorders in realtime when new message arrives
- [ ] All contact fields populated from API (avatar, email, company)
- [ ] Files can be attached and sent via paperclip button
- [ ] AI drawer shows computed (non-hardcoded) data
- [ ] Quick actions open correct Frappe forms
- [ ] Mobile Contacts and Calls tabs have content
- [ ] Account switching reloads correct messages
- [ ] Response time shows real computed value

---

## Handbook Updates Required

- `frontend_gaps_handbook.md`: Mark resolved items, update counts
- `technical_handbook.md`: Document new API endpoints
- `psychological_handbook.md`: Note that UI now matches "reduce cognitive load" principle
