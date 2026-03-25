---
name: python-quality
description: Python code quality — type hints, error handling, structure, testing checklist. Use when writing or reviewing Python code.
---

# Python Quality Standards

## Type Hints (mandatory on all public functions)
```python
from typing import Optional

def get_conversation(
    conversation_id: str,
    include_messages: bool = False
) -> Optional[dict]:
    """Fetch conversation with optional message history."""
    ...
```

- Use `Optional[X]` not `X | None` (Python 3.10 compat)
- Return type always specified
- Complex dicts: use `TypedDict`
```python
from typing import TypedDict

class ConversationData(TypedDict):
    name: str
    channel: str
    status: str
    unread_count: int
```

## Error Handling
```python
# GOOD — specific exception, user-facing error
try:
    doc = frappe.get_doc("Excom Conversation", name)
except frappe.DoesNotExistError:
    frappe.throw(f"Conversation {name} not found", frappe.DoesNotExistError)

# GOOD — background job error logging
try:
    send_whatsapp_message(conversation, content)
except Exception as e:
    frappe.log_error(f"WhatsApp send failed for {conversation}: {e}")
    raise  # re-raise so RQ marks job as failed

# BAD — never do this
except:
    pass
```

## File Structure
- Max 500 lines per file — split into modules if larger
- Max 50 lines per function — extract helpers
- One class per file for controllers
- Group related functions in module files

## Import Order
```python
# 1. Standard library
import json
from datetime import datetime

# 2. Third-party
import requests

# 3. Frappe
import frappe
from frappe.model.document import Document

# 4. Local app
from excom.channel.utils import resolve_identity
```

## Docstrings
```python
def assign_conversation(
    conversation_id: str,
    user: Optional[str] = None
) -> str:
    """Assign conversation to a user via the Assignment Engine.
    
    If user is not specified, uses round-robin queue assignment.
    Returns the assigned user's email.
    
    Raises:
        frappe.ValidationError: If conversation is already closed.
    """
```

## Pre-commit Checklist
1. Type hints on all public functions
2. No bare `except:` blocks
3. `frappe.log()` not `print()`
4. `frappe.throw()` for user errors
5. Tests cover happy path + main error cases
6. Permissions tested with different user roles
