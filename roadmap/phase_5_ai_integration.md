# Phase 5: AI Integration -- Intelligence Layer

Priority: MEDIUM
Estimated Effort: 12-18 days
Dependency: Phase 2 (frontend AI stubs wired), Phase 1 (event bus for triggers)

---

## Objective

Build the AI intelligence layer that powers contact profiling, suggested replies, conversation summaries, sentiment analysis, auto-translation, and smart routing. Replace all hardcoded AI data in the frontend with real intelligence. ERPNext-aware context injection is Excom's differentiator.

---

## 5.1 AI Service Architecture

### Design Principles (from psychological_handbook.md)
- AI is assistive, not authoritative. Human operators retain final judgment.
- AI outputs must be explainable and tied to a known data window.
- Deterministic per input window, recomputed through background jobs.
- Profile text is draft intelligence; operators can edit.

### 5.1.1 AI Service Module
Create `excom/excom/services/ai_service.py`:

Core interface:
- `generate_contact_profile(omni_identity)` returns dict
- `suggest_replies(thread_id, count=3)` returns list
- `summarize_conversation(thread_id)` returns dict
- `analyze_sentiment(message_content)` returns dict
- `recommend_actions(thread_id, omni_identity)` returns list
- `compute_insights(omni_identity)` returns dict

### 5.1.2 LLM Provider Abstraction
Create `excom/excom/services/llm_provider.py`:
- Abstract base class LLMProvider with `complete(prompt, context)` method.
- Implementations:
  - OpenAIProvider (GPT-4 / GPT-3.5)
  - OllamaProvider (local LLM for self-hosted)
  - FrappeAIProvider (if Frappe AI module exists)
- Provider selection via Excom Settings DocType field.
- API key stored in Frappe Password field (encrypted at rest).

### 5.1.3 Excom AI Settings
Add AI configuration to Excom Settings (or create if not exists):

| Field | Type | Purpose |
|---|---|---|
| ai_enabled | Check | Global AI toggle |
| ai_provider | Select | OpenAI / Ollama / Custom |
| ai_api_key | Password | Provider API key |
| ai_model | Data | Model name (gpt-4, llama3) |
| ai_base_url | Data | Custom endpoint URL (for Ollama/self-hosted) |
| ai_max_context_messages | Int | Max messages to include in prompt context |
| ai_profile_refresh_hours | Int | Hours between automatic profile regeneration |

Complexity: Medium

---

## 5.2 Contact Profiling (AI Behavioral Summary)

### From technical_handbook.md
Fields planned on Contact custom fields:
- excom_profile_summary (Long Text)
- excom_profile_tags (Data or JSON text)
- excom_profile_sentiment (Select)
- excom_profile_last_updated_on (Datetime)
- excom_profile_confidence (Float)

Also on Omni Identity:
- ai_profile_summary (already exists)

### Implementation

#### 5.2.1 Profile Generation Pipeline
1. Trigger: Background job on schedule (ai_profile_refresh_hours interval) OR on-demand via API.
2. Data Collection: Gather last N messages from all threads for this Omni Identity.
3. ERPNext Context Injection (Excom's edge over Rocket.Chat):
   - Fetch linked Contact/Lead/Customer data.
   - Include: company name, lead status, opportunity stage, outstanding invoices, support ticket count.
   - This gives the AI business context that pure chat platforms lack.
4. Prompt Construction: System prompt + conversation history + ERPNext context.
5. LLM Call: Generate summary, tags, sentiment.
6. Storage: Update ai_profile_summary on Omni Identity, custom fields on Contact.
7. Confidence Score: Based on message count and recency (more data = higher confidence).

#### 5.2.2 Profile API
`excom.excom.api.ai.get_contact_profile(omni_identity)`:
- Returns current profile or generates on-demand if stale/missing.
- Frontend: display in OmniIdentityPanel.tsx and MobileContactView.tsx.

Complexity: High

---

## 5.3 Suggested Replies

### Current State
AIAssistantDrawer.tsx and MobileAIDrawer.tsx show 3 hardcoded suggestions.

### Implementation

#### 5.3.1 Reply Generation
`excom.excom.api.ai.get_suggested_replies(thread_id)`:
1. Fetch last N messages from thread.
2. Fetch canned responses relevant to this contact/department.
3. Fetch ERPNext context (deal stage, pending actions).
4. Prompt LLM: "Based on this conversation and business context, suggest 3 appropriate responses."
5. Return list of `{text, confidence, reasoning}`.

#### 5.3.2 Canned Response Ranking
When canned responses exist (Phase 3), rank them by relevance:
- Keyword match scoring.
- Usage frequency for similar conversations.
- LLM re-ranking if AI is enabled.

#### 5.3.3 Frontend Wiring
- "Generate More Suggestions" button calls API with force_refresh=True.
- Click on suggestion inserts text into message input via callback.
- Show confidence indicator on each suggestion.

Complexity: Medium

---

## 5.4 Conversation Summary

### Implementation

#### 5.4.1 Summary Generation
`excom.excom.api.ai.get_conversation_summary(thread_id)`:
1. Fetch all messages in thread (or last N for long conversations).
2. Prompt LLM: "Summarize this conversation in 2-3 sentences. Include: topic, customer intent, current status, pending actions."
3. Return `{text, sentiment, key_topics[], updated_at}`.

#### 5.4.2 Auto-Summarize on Thread Close
When a thread is closed, auto-generate and store summary on the thread:
- Add ai_summary (Long Text) field on Excom Thread.
- Useful for: handoff context, historical reference, analytics.

#### 5.4.3 Transcript Generation
Generate exportable conversation transcript (inspired by RC omnichannel-transcript):
- PDF or HTML format.
- Include: all messages, timestamps, agent names, system events, attachments list.
- Useful for: compliance, customer requests, dispute resolution.

Complexity: Medium

---

## 5.5 Sentiment Analysis

### Implementation

#### 5.5.1 Per-Message Sentiment
On inbound message ingestion:
1. If AI is enabled, analyze sentiment of message text.
2. Store sentiment (Positive/Neutral/Negative/Urgent) on Excom Message.
3. Lightweight: can use a simple classifier or LLM.

#### 5.5.2 Thread-Level Sentiment
Aggregate message sentiments to compute thread-level sentiment:
- Rolling average or latest-message-weighted.
- Display as color indicator in ChatThreadList.tsx (green/yellow/red).

#### 5.5.3 Sentiment-Based Routing
Integration with routing engine (Phase 4):
- Negative/Urgent sentiment -> boost priority.
- Route to senior agents or supervisors.

Complexity: Medium

---

## 5.6 Recommended Next Actions

### Implementation
`excom.excom.api.ai.get_recommended_actions(thread_id, omni_identity)`:

Action types based on ERPNext context:

| Trigger | Recommended Action |
|---|---|
| No Lead linked | "Create Lead from this conversation" |
| Lead exists, no Opportunity | "Create Opportunity" |
| Opportunity exists | "Send Quotation" |
| Open support ticket | "Follow up on Ticket #name" |
| Customer has overdue invoice | "Remind about Invoice #name" |
| No recent contact | "Schedule follow-up call" |
| Conversation mentions demo | "Schedule demo meeting" |

Each action returns `{action, label, priority, url, params}` so the frontend can navigate or execute.

Complexity: Medium

---

## 5.7 Auto-Translation

### What Rocket.Chat Has
autotranslate module with DeepL, Google Translate, Microsoft Translate providers.

### Excom Implementation

#### 5.7.1 Translation Service
Create `excom/excom/services/translation_service.py`:
- Detect language of incoming message.
- Translate to agent's preferred language.
- Store original and translated text on Excom Message:
  - original_language (Data)
  - translated_content (Long Text)
- Use LLM provider for translation (most modern LLMs handle translation well).

#### 5.7.2 Translation UI
- Show original message with "Translated" badge.
- Toggle to view original text.
- Agent can compose in their language; auto-translate before sending (optional, with confirmation).

Complexity: Medium

---

## 5.8 AI-Powered Smart Routing (Excom Differentiator)

Beyond Rocket.Chat's pattern -- use AI to determine routing:

### Implementation
1. On new conversation, analyze first message intent.
2. Classify: Sales inquiry / Support issue / Billing question / General.
3. Route to appropriate department based on classification.
4. Factor in: customer value (from ERPNext), sentiment urgency, conversation history.

This is NOT available in Rocket.Chat and represents Excom's competitive edge.

Complexity: High

---

## 5.9 AI Chatbot Handoff Intelligence

### Current State
Excom has WhatsApp Agent Transfer but no intelligence layer for when to hand off.

### Implementation
- Monitor chatbot conversation for signals:
  - Customer expresses frustration (sentiment shift).
  - Customer explicitly asks for human.
  - Chatbot confidence drops below threshold.
  - Conversation exceeds N turns without resolution.
- Trigger smooth handoff: transfer thread to human agent queue with chatbot conversation context pre-loaded.

Complexity: High

---

## Validation Checklist

- [ ] Contact profiles generate from conversation history + ERPNext data
- [ ] Suggested replies are contextual and not hardcoded
- [ ] Conversation summaries generate accurately
- [ ] Sentiment indicators appear on messages and threads
- [ ] Next actions reference real ERPNext entities
- [ ] Auto-translation works for at least 5 languages
- [ ] AI routing classifies intents correctly
- [ ] Chatbot-to-human handoff triggers on frustration signals

---

## Handbook Updates Required

- technical_handbook.md: Document AI service architecture, LLM provider abstraction, profile generation pipeline
- psychological_handbook.md: Reinforce "AI is assistive, not authoritative" with implementation examples
