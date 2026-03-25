---
name: channel-adapters
description: Channel integration patterns for WhatsApp, Email, Instagram in Excom. Use when building or modifying channel connectors, webhook handlers, OAuth flows, or Omni Identity resolution.
---

# Channel Adapter Pattern

Every channel implements a common interface:
- `send_message(conversation_id, content, attachments)` → send outgoing
- `receive_webhook(payload)` → parse incoming webhook
- `sync_history(contact_id, since)` → backfill past messages
- `get_contact_info(identifier)` → resolve identity

## Email — Gmail API (Pointer-Based Storage)

### Architecture
- Store `message_id`, `thread_id`, `labels` in Frappe — NOT the email body
- Fetch full content on-demand via Gmail API `messages.get()`
- This keeps MariaDB lightweight even with millions of emails

### OAuth2 Flow
```python
# Token storage: use Frappe Password field (encrypted)
# Token refresh: automatic before every API call
def get_gmail_service(user_email):
    credentials = get_stored_credentials(user_email)  # from Password field
    if credentials.expired:
        credentials.refresh(Request())
        store_credentials(user_email, credentials)
    return build("gmail", "v1", credentials=credentials)
```

### Push Notifications
- Set up Google Pub/Sub watch on user's mailbox
- Watch expires every 7 days — renew via scheduled task
- On notification: fetch only new message IDs since last sync

### Rate Limits
- 250 quota units/second per user
- Batch requests for bulk operations
- Exponential backoff on 429 errors

## WhatsApp Business API

### 24-Hour Messaging Window
- Free-form messages allowed within 24h of last customer message
- After 24h: must use pre-approved Template Messages
- Track `last_customer_message_at` on each conversation

### Webhook Handler
```python
@frappe.whitelist(allow_guest=True)
def whatsapp_webhook():
    # 1. Verify signature from X-Hub-Signature-256 header
    verify_whatsapp_signature(frappe.request)
    
    # 2. Parse payload
    data = frappe.request.get_json()
    
    # 3. Handle verification challenge
    if frappe.request.args.get("hub.mode") == "subscribe":
        return verify_webhook_challenge(frappe.request.args)
    
    # 4. Process messages
    for entry in data.get("entry", []):
        for change in entry.get("changes", []):
            process_whatsapp_message(change["value"])
```

### Media Handling
- WhatsApp CDN URLs expire in 30 days
- Download and store media in Frappe File on receipt
- Or proxy through your server for on-demand access

## Instagram — Graph API

### Token Lifecycle
- Short-lived token → exchange for long-lived (60 days)
- Refresh before expiry via scheduled task
- Store in Password field like Gmail tokens

### Webhook Subscriptions
- Subscribe via Facebook Developer Dashboard
- Separate endpoints for: messages, story_mentions, comments
- Verify with hub.verify_token from site_config.json

## Omni Identity Resolution

### Matching Priority
1. Phone number (exact match) → highest confidence
2. Email address (exact match) → high confidence
3. Instagram ID → medium confidence
4. Name fuzzy match → low confidence (flag for manual review)

### Flow
```
Incoming message → Extract identifier (phone/email/ig_id)
  → Search existing Omni Identity
    → Found? Link to conversation
    → Not found? Search ERPNext Contact
      → Found? Create Omni Identity, link both
      → Not found? Create new Contact + Omni Identity
```

### Merging Duplicates
- Same person messages via WhatsApp AND email
- Detect: same phone on Contact linked to different Omni Identities
- Merge: keep oldest Omni Identity, move all conversations to it
- Alert: flag for human review before auto-merge
