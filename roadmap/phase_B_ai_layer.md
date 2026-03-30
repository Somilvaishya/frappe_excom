# Phase B: AI Intelligence Layer

Priority: MEDIUM-HIGH
Estimated Effort: 5-8 days
Dependency: Phase A (security in place)

---

## Objective

Replace hardcoded AI stubs in the frontend with real intelligence. Keep it lean — one LLM provider, three core features, no over-abstraction. Add more AI capabilities later based on what agents actually ask for.

---

## B.1 AI Service Setup

### Excom Settings — AI Fields

Add to existing Excom Settings (or Excom Channel Account settings section):

| Field | Type | Purpose |
|---|---|---|
| ai_enabled | Check | Global AI toggle |
| ai_provider | Select | OpenAI / Ollama |
| ai_api_key | Password | Provider API key (encrypted) |
| ai_model | Data | Model name (gpt-4o-mini, llama3, etc.) |
| ai_base_url | Data | Custom endpoint URL (for Ollama/self-hosted) |
| ai_max_context_messages | Int (default 20) | Max messages to include in prompt |

### LLM Client

Create `excom/excom/services/llm_client.py`:

- Single function: `llm_call(system_prompt: str, user_prompt: str) -> str`
- Reads provider/key/model from Excom Settings.
- Uses `requests` to call OpenAI-compatible API (works for both OpenAI and Ollama).
- Handles errors gracefully — returns None on failure, logs via `frappe.log_error()`.
- No abstract base classes, no provider factory. Just one function that works.

Complexity: Low

---

## B.2 Suggested Replies

Replace hardcoded suggestions in AIAssistantDrawer / MobileAIDrawer.

### Backend

`excom.excom.api.ai.get_suggested_replies(thread_id)`:

1. Fetch last N messages from the thread.
2. Fetch linked Omni Identity context (name, channel, any linked ERP entities).
3. Prompt: "Based on this conversation, suggest 3 short professional replies the agent could send."
4. Return list of `{text}`.
5. Cache result in Redis for 5 minutes (invalidate on new message).

### Frontend

- Wire existing suggestion UI to call the API.
- Show loading spinner while generating.
- Click to insert into message composer.
- "Regenerate" button to force-refresh.

Complexity: Medium

---

## B.3 Conversation Summary

### Backend

`excom.excom.api.ai.get_conversation_summary(thread_id)`:

1. Fetch all messages in thread (capped at ai_max_context_messages).
2. Prompt: "Summarize this conversation in 2-3 sentences. Include: topic, customer intent, current status, any pending actions."
3. Return `{summary, updated_at}`.
4. Store on Excom Thread field `ai_summary` (Long Text) for future reference.

### Auto-Summary on Close

When thread status changes to Closed, auto-generate summary in background (`frappe.enqueue`).

### Frontend

- Show summary in OmniIdentityPanel or thread header.
- "Regenerate Summary" button for manual refresh.

Complexity: Medium

---

## B.4 Contact Profiling

### Backend

`excom.excom.api.ai.get_contact_profile(omni_identity)`:

1. Gather last N messages across all threads for this identity.
2. Include any linked ERP context (Customer name, Lead status, outstanding invoices — if available).
3. Prompt: "Based on these conversations, write a brief behavioral profile of this contact. Include: communication style, interests/needs, sentiment, and any key facts mentioned."
4. Return `{profile_summary, tags[], updated_at}`.
5. Store on Omni Identity `ai_profile_summary` field.

### Scheduled Refresh

Daily background job: regenerate profiles for identities with new messages since last profile update.

### Frontend

- Display profile in OmniIdentityPanel (Profile tab).
- Replace any hardcoded profile data with real AI-generated content.

Complexity: Medium

---

## Validation Checklist

- [ ] AI toggle in settings enables/disables all AI features
- [ ] LLM client works with OpenAI API
- [ ] LLM client works with Ollama (self-hosted)
- [ ] Suggested replies return 3 contextual responses
- [ ] Suggestions refresh on new messages
- [ ] Conversation summary generates on-demand
- [ ] Auto-summary triggers on thread close
- [ ] Contact profile generates from conversation history
- [ ] Profiles auto-refresh daily for active contacts
- [ ] All AI calls fail gracefully (no broken UI when AI is off or errors)

---

## What We're NOT Building Yet

These are deferred until agents ask for them:
- Sentiment analysis (per-message or thread-level)
- Auto-translation
- AI-powered smart routing
- Chatbot handoff intelligence
- Recommended next actions (ERPNext-linked)
- AI canned response ranking
