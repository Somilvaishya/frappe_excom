# Excom Frontend Gaps Handbook

Tracks every hardcoded value, non-functional button, and incomplete feature
in the current frontend implementation. Updated after each change.

Last updated: 2026-02-24 (v5 -- Phase 2 frontend completion)

---

## 1. Hardcoded Values

### ~~AIAssistantDrawer.tsx~~ -- FIXED (Phase 2)

| What | Status |
|------|--------|
| ~~`SUGGESTED_REPLIES`~~ | **FIXED** — Now fetched from `get_ai_suggestions` API, based on recent outbound messages |
| ~~`NEXT_ACTIONS`~~ | **FIXED** — Derived from linked ERP entity statuses |
| ~~Conversation summary~~ | **FIXED** — Computed from actual message count and last activity |
| ~~Response pattern~~ | **FIXED** — Calculated from actual message response times |
| ~~Engagement level~~ | **FIXED** — Calculated from outbound/inbound ratio |
| ~~Best contact time~~ | **FIXED** — Derived from inbound message timestamp analysis |

### ~~MobileAIDrawer.tsx~~ -- FIXED (Phase 2)

| What | Status |
|------|--------|
| All AI data | **FIXED** — Uses same `useAISuggestions` hook as desktop |

### ~~OmniIdentityPanel.tsx~~ -- FIXED

| What | Current Value | Should Be |
|------|--------------|-----------|
| ~~Response time~~ | ~~"~5 min"~~ | **FIXED** -- Now fetched from `get_conversation_stats` API. Shows total messages, inbound/outbound breakdown, team replied status, avg response time, and channels -- all from live Excom Message data. |

### ~~MobileContactView.tsx~~ -- FIXED

| What | Current Value | Should Be |
|------|--------------|-----------|
| ~~Response time~~ | ~~"~5m"~~ | **FIXED** -- Same `useConversationStats` hook as desktop. Shows total messages, avg response time, inbound/outbound counts, and team replied badge -- all from live data. |

### useContacts.ts (hook)

| What | Current Value | Should Be |
|------|--------------|-----------|
| ~~`contactAvatar`~~ | ~~Always `""`~~ | **FIXED** (Phase 2) — Fetched from `get_threads` JOIN on Omni Identity `image` field |
| ~~`contactInfo.email`~~ | ~~Always `""`~~ | **FIXED** (Phase 2) — Fetched from `get_threads` JOIN on Omni Identity `primary_email` |
| ~~`contactInfo.company`~~ | ~~Always `""`~~ | **FIXED** (Phase 2) — Fetched from linked Contact/Lead/Customer via `_enrich_company()` |
| ~~`contactInfo.erpEntity`~~ | ~~Always `undefined`~~ | **PARTIAL FIX** — Linked ERP Entities section now fetches all links from Omni Identity via `get_linked_entities` API and displays them in the right sidebar (OmniIdentityPanel) and mobile contact view with open links. Single erpEntity badge on contact card still unused. |
| `status` | Always `"offline"` | Derived from last_seen or realtime presence — deferred to Phase 3+ |
| `aiStatus` | Always `undefined` | Fetched from thread or AI service state — deferred to Phase 5 |
| ~~`assignedTo.avatar`~~ | ~~Always `""`~~ | **FIXED** (Phase 2) — Fetched from `get_threads` JOIN on User `user_image` |
| ~~`allMessages`~~ | ~~Always `[]`~~ | **FIXED** -- ChannelTabsView and MobileChannelView now use `useMessages(threadId)` to fetch messages directly when a thread is selected. `allMessages` on UnifiedContact remains empty (unused at list level). |

---

## 2. Non-Functional Buttons & Actions

### ~~AIAssistantDrawer.tsx~~ -- FIXED (Phase 2)

| Button | Status |
|--------|--------|
| ~~Suggested reply click~~ | **FIXED** — Calls `onUseSuggestion` callback to insert text |
| ~~"Start" on actions~~ | **FIXED** — Opens relevant Frappe form (Lead/Customer) in new tab |
| ~~"Generate More Suggestions"~~ | **FIXED** — Calls `refresh()` on `useAISuggestions` hook |

### ~~ChannelTabsView.tsx~~ -- FIXED (Phase 2)

| Button | Status |
|--------|--------|
| ~~Send message~~ | **FIXED** — Optimistic send + error recovery |
| ~~"Take Over" button~~ | **FIXED** — Calls `assign_thread` API |
| ~~Paperclip button~~ | **FIXED** — Opens file picker, uploads via Frappe, sends as media message |
| ~~Image button~~ | **FIXED** — Same as Paperclip |

### ~~OmniIdentityPanel.tsx~~ -- FIXED (Phase 2)

| Button | Status |
|--------|--------|
| ~~"View in ERPNext"~~ | **FIXED** — Opens first linked entity form (or Omni Identity) |
| ~~"Send Email"~~ | **FIXED** — Opens `mailto:` with contact email |
| ~~"Schedule Meeting"~~ | **FIXED** — Opens Event form with Contact party pre-filled |

### ~~MobileChannelView.tsx~~ -- FIXED (Phase 2)

| Button | Status |
|--------|--------|
| ~~Send message~~ | **FIXED** — Optimistic send + error recovery |
| ~~"Take Over" button~~ | **FIXED** — Calls `assign_thread` API |
| ~~Paperclip attachment~~ | **FIXED** — Opens file picker, uploads via Frappe |

### ~~MobileApp.tsx~~ -- FIXED (Phase 2)

| Button | Status |
|--------|--------|
| ~~Bottom nav "Calls" tab~~ | **FIXED** — Shows "Coming Soon" placeholder |
| ~~Bottom nav "Contacts" tab~~ | **FIXED** — Shows searchable contacts list (`MobileContactsList`) |

### ~~MobileContactView.tsx~~ -- FIXED (Phase 2)

| Button | Status |
|--------|--------|
| ~~"View in ERPNext"~~ | **FIXED** — Opens first linked entity form |
| ~~"Send Email"~~ | **FIXED** — Opens `mailto:` with contact email |
| ~~"Schedule Meeting"~~ | **FIXED** — Opens Event form |

### CallScreen.tsx

| Button | Current Behavior | Expected Behavior |
|--------|-----------------|-------------------|
| Mute toggle | Toggles local state only | Control actual microphone via WebRTC |
| End call | Calls `onEndCall` (navigates back) | Terminate real call session |
| Video toggle | Toggles local state only | Control actual camera via WebRTC |
| Speaker toggle | Toggles local state only | Switch audio output device |

---

## 3. Incomplete / Stubbed Features

### Message Loading -- FIXED

Both `ChannelTabsView` and `MobileChannelView` now use `useMessages(selectedAccountId)`
to fetch messages from the Frappe API when a thread is selected. The `selectedAccountId`
is the `ExcomThread.name` which serves as the `thread_id` for the messages API.

### ~~Message Sending~~ -- FIXED (Phase 1 + Phase 2 optimistic send)

### ~~AI Assistant Integration~~ -- FIXED (Phase 2 stub API)

### ~~File Attachments~~ -- FIXED (Phase 2)

### Call Screen

The entire call screen is UI-only. It simulates connecting/ringing/active
states with timers but has no real communication backend. Needs:
- WebRTC or VOIP integration
- Call initiation and termination APIs
- Real audio/video stream handling

### ~~Contact Data Enrichment~~ -- FIXED (Phase 2, avatar/email/company/assignedTo)

Remaining: `status` (online/offline) needs realtime presence, `aiStatus` deferred to Phase 5.

### ~~Mobile Navigation~~ -- FIXED (Phase 2, Calls placeholder + Contacts list)

### ~~Account Switching~~ -- FIXED (Phase 2, parent-child state sync)

---

## 4. Summary Counts (Post Phase 2)

| Category | Remaining | Fixed in Phase 2 |
|----------|-----------|-----------------|
| Hardcoded data points | 2 (status, aiStatus) | 16 |
| Non-functional buttons | 4 (CallScreen controls) | 15+ |
| Incomplete features | 2 (Call screen, online presence) | 7 |

---

## 5. Remaining Priorities

1. **Online presence / last_seen** — needs realtime tracking (Phase 3+)
2. **AI status (aiStatus)** — needs AI service integration (Phase 5)
3. **Call screen** — requires VOIP/WebRTC infrastructure (future)
4. **erpEntity badge** on contact card — minor UI, data available via `get_linked_entities`
 