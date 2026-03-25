---
name: api-design
description: REST API design patterns — endpoint naming, error formats, pagination, versioning. Use when designing or reviewing API endpoints.
---

# API Design for Excom

## Frappe API Structure
Frappe has two API styles. Use both appropriately:

### Resource API (CRUD on doctypes)
```
GET    /api/resource/Excom Conversation?filters=...&fields=...
GET    /api/resource/Excom Conversation/CONV-001
POST   /api/resource/Excom Conversation
PUT    /api/resource/Excom Conversation/CONV-001
DELETE /api/resource/Excom Conversation/CONV-001
```
Use for: standard CRUD where Frappe's built-in permissions handle access.

### Method API (custom logic)
```
POST   /api/method/excom.api.conversations.get_inbox
POST   /api/method/excom.api.messages.send_message
POST   /api/method/excom.api.assignment.assign_to_agent
```
Use for: custom business logic, aggregations, multi-step operations.

## Response Format (consistent across all custom APIs)
```python
# Success
frappe.response["message"] = {
    "data": result,
    "meta": {"total": count, "limit": limit, "offset": offset}
}

# Error (let frappe.throw handle this)
frappe.throw("Conversation not found", frappe.DoesNotExistError)
# Frappe auto-returns: {"exc_type": "DoesNotExistError", "exception": "..."}
```

## Pagination
```python
@frappe.whitelist()
def get_inbox(limit: int = 20, offset: int = 0, status: str = "Open"):
    total = frappe.db.count("Excom Conversation", {"status": status})
    
    conversations = frappe.get_list("Excom Conversation",
        filters={"status": status},
        fields=["name", "subject", "channel", "last_message_at", "unread_count"],
        order_by="last_message_at desc",
        limit_page_length=limit,
        start=offset,
    )
    
    frappe.response["message"] = {
        "data": conversations,
        "meta": {"total": total, "limit": limit, "offset": offset}
    }
```

## Naming Conventions
- Method paths: `excom.api.<module>.<function_name>`
- Function names: verb_noun — `get_inbox`, `send_message`, `assign_to_agent`
- Keep paths shallow: max 4 segments

## Validation Pattern
```python
@frappe.whitelist()
def send_message(conversation: str, content: str, channel: str = None):
    # 1. Validate required params
    if not conversation or not content:
        frappe.throw("conversation and content are required")
    
    # 2. Check permissions
    frappe.has_permission("Excom Conversation", "write", conversation, throw=True)
    
    # 3. Validate business rules
    conv = frappe.get_doc("Excom Conversation", conversation)
    if conv.status == "Closed":
        frappe.throw("Cannot send message to a closed conversation")
    
    # 4. Execute
    message = create_and_send_message(conv, content)
    
    frappe.response["message"] = {"data": message.as_dict()}
```

## Rate Limiting
- Webhook endpoints: use Frappe's rate_limit decorator
```python
@frappe.whitelist(allow_guest=True)
@frappe.rate_limit(limit=100, seconds=60)
def whatsapp_webhook():
    ...
```
