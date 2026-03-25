---
name: frappe-development
description: Frappe Framework development patterns — doctypes, ORM, hooks, APIs, background jobs, realtime, testing. Use when creating doctypes, writing whitelisted APIs, handling doc_events, scheduled tasks, or working with bench commands.
---

# Frappe Development Patterns

## Creating a New Doctype
1. Define doctype JSON (fields, permissions, naming rule, module)
2. Create controller: `excom/<module>/<doctype>/<doctype>.py`
3. Add client script if needed: `<doctype>.js`
4. Register doc_events in `hooks.py` if needed
5. Run `bench migrate`
6. Write tests in `excom/tests/test_<doctype>.py`

## Doctype Controller Pattern
```python
import frappe
from frappe.model.document import Document

class ExcomConversation(Document):
    def validate(self):
        """Runs before save — validate data here"""
        if not self.channel:
            frappe.throw("Channel is required")
    
    def on_update(self):
        """Runs after save — side effects here"""
        frappe.publish_realtime("conversation_updated", 
            {"name": self.name}, user=self.assigned_to)
    
    def before_insert(self):
        """Runs before first save only"""
        self.status = "Open"
```

## Whitelisted API Pattern
```python
@frappe.whitelist()
def get_conversations(status="Open", limit=20, offset=0):
    frappe.has_permission("Excom Conversation", "read", throw=True)
    
    conversations = frappe.get_list("Excom Conversation",
        filters={"status": status},
        fields=["name", "subject", "channel", "last_message_at"],
        order_by="last_message_at desc",
        limit_page_length=limit,
        start=offset
    )
    return conversations
```

## hooks.py Registration
```python
doc_events = {
    "Excom Message": {
        "after_insert": "excom.channel.handler.on_new_message"
    }
}

scheduler_events = {
    "cron": {
        "*/5 * * * *": [
            "excom.channel.email.sync.poll_gmail"
        ]
    }
}
```

## Background Jobs
```python
# Enqueue for async processing
frappe.enqueue(
    "excom.channel.whatsapp.send.send_message",
    queue="default",
    conversation=conversation_name,
    content=message_text,
    now=frappe.flags.in_test  # run synchronously in tests
)
```

## Frappe ORM Quick Reference
```python
# Get single doc
doc = frappe.get_doc("Excom Conversation", "CONV-001")

# Get value without loading full doc
status = frappe.db.get_value("Excom Conversation", "CONV-001", "status")

# Get list with filters
msgs = frappe.get_list("Excom Message",
    filters={"conversation": "CONV-001"},
    fields=["name", "content", "sent_at"],
    order_by="sent_at asc"
)

# Quick update
frappe.db.set_value("Excom Conversation", "CONV-001", "status", "Replied")

# Exists check
if frappe.db.exists("Excom Conversation", {"email": "test@test.com"}):
    pass

# Count
count = frappe.db.count("Excom Message", {"conversation": "CONV-001"})
```

## Testing Pattern
```python
import frappe
from frappe.tests.utils import FrappeTestCase

class TestExcomConversation(FrappeTestCase):
    def setUp(self):
        self.conversation = frappe.get_doc({
            "doctype": "Excom Conversation",
            "channel": "Email",
            "subject": "Test"
        }).insert()
    
    def tearDown(self):
        frappe.db.rollback()
    
    def test_new_conversation_is_open(self):
        self.assertEqual(self.conversation.status, "Open")
    
    def test_permission_check(self):
        frappe.set_user("guest@example.com")
        self.assertRaises(frappe.PermissionError,
            frappe.get_doc, "Excom Conversation", self.conversation.name)
        frappe.set_user("Administrator")
```
