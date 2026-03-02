"""
Core service layer for Excom Thread and Message operations.

All inbound/outbound message flows route through here to guarantee
consistent thread state, idempotency, and identity resolution.
"""

import json
import re

import frappe
from frappe import _

from excom.excom.doctype.omni_identity.omni_identity import resolve_identity
from excom.excom.utils import get_channel_account


def upsert_thread(omni_identity: str, channel: str, account: str) -> str:
    """
    Find or create an Excom Thread for the given identity + channel + account.
    Returns the thread name.
    """
    thread_key = f"{channel}:{account}:{omni_identity}"

    existing = frappe.db.get_value("Excom Thread", {"thread_key": thread_key}, "name")
    if existing:
        return existing

    oi = frappe.db.get_value(
        "Omni Identity", omni_identity,
        ["display_name", "primary_phone"], as_dict=True,
    )

    doc = frappe.get_doc({
        "doctype": "Excom Thread",
        "omni_identity": omni_identity,
        "channel": channel,
        "account_doctype": "Excom Channel Account",
        "account": account,
        "thread_key": thread_key,
        "status": "Open",
        "display_name": oi.display_name if oi else "Unknown",
        "primary_phone": oi.primary_phone if oi else "",
        "unread_count": 0,
    })
    doc.insert(ignore_permissions=True)

    return doc.name


def ingest_inbound_message(
    phone: str,
    channel: str,
    account: str,
    provider_message_id: str,
    content_text: str,
    message_type: str = "Text",
    display_name: str = "",
    content_json: dict = None,
    media_file: str = "",
    reply_to_provider_id: str = "",
    provider_timestamp: str = "",
) -> str:
    """
    Full inbound message ingestion pipeline.

    1. Resolve identity
    2. Upsert thread
    3. Check idempotency
    4. Insert Excom Message
    5. Update thread counters

    Returns the Excom Message name, or empty string if duplicate.
    """
    if provider_message_id and frappe.db.exists(
        "Excom Message", {"provider_message_id": provider_message_id}
    ):
        return ""

    identity_name = resolve_identity(
        phone=phone,
        channel=channel,
        channel_user_id=phone,
        display_name=display_name,
    )

    thread_name = upsert_thread(identity_name, channel, account)

    reply_to = ""
    if reply_to_provider_id:
        reply_to = frappe.db.get_value(
            "Excom Message",
            {"provider_message_id": reply_to_provider_id},
            "name",
        ) or ""

    now = frappe.utils.now_datetime()
    preview = _make_preview(content_text)

    msg = frappe.get_doc({
        "doctype": "Excom Message",
        "thread": thread_name,
        "omni_identity": identity_name,
        "channel": channel,
        "account_doctype": "Excom Channel Account",
        "account": account,
        "direction": "Inbound",
        "message_type": message_type,
        "provider_message_id": provider_message_id,
        "provider_timestamp": provider_timestamp or now,
        "content_text": content_text,
        "content_json": json.dumps(content_json) if content_json else "{}",
        "media_file": media_file,
        "delivery_status": "Delivered",
        "reply_to": reply_to,
    })
    msg.insert(ignore_permissions=True)

    frappe.db.sql(
        """
        UPDATE `tabExcom Thread`
        SET last_message_at = %(now)s,
            last_inbound_at = %(now)s,
            unread_count = unread_count + 1,
            last_message_preview = %(preview)s,
            last_message_direction = 'Inbound',
            status = CASE WHEN status = 'Closed' THEN 'Open' ELSE status END,
            modified = %(now)s
        WHERE name = %(thread)s
        """,
        {"now": now, "preview": preview, "thread": thread_name},
    )

    frappe.db.commit()

    frappe.publish_realtime(
        "excom:message_received",
        {
            "thread": thread_name,
            "message": msg.name,
            "omni_identity": identity_name,
            "direction": "Inbound",
            "preview": preview,
        },
    )
    frappe.publish_realtime(
        "excom:thread_updated",
        {"thread": thread_name, "event": "new_inbound"},
    )

    return msg.name


def send_outbound_message(
    thread_name: str,
    content_text: str,
    message_type: str = "Text",
    media_file: str = "",
    template: str = "",
    reply_to: str = "",
) -> str:
    """
    Send an outbound message through the channel provider.

    1. Load thread and account
    2. Call provider API
    3. Insert Excom Message
    4. Update thread counters

    Returns the Excom Message name.
    """
    thread = frappe.get_doc("Excom Thread", thread_name)
    identity = frappe.get_doc("Omni Identity", thread.omni_identity)

    to_number = identity.primary_whatsapp or identity.primary_phone
    if not to_number:
        frappe.throw(_("No phone number on identity to send to"))

    # Resolve account: prefer Excom Channel Account; fall back to legacy WhatsApp Account
    account_doctype = thread.account_doctype
    account_name = thread.account
    if account_doctype == "WhatsApp Account" and frappe.db.exists("Excom Channel Account", account_name):
        account = frappe.get_doc("Excom Channel Account", account_name)
        frappe.db.set_value("Excom Thread", thread_name, "account_doctype", "Excom Channel Account")
        account_doctype, account_name = "Excom Channel Account", account.name
    else:
        account = frappe.get_doc(account_doctype, account_name)

    provider_message_id = ""
    delivery_status = "Queued"

    if thread.channel == "email":
        frappe.throw(
            _("Use the email API (excom.excom.api.email.send_email) for email threads. "
              "The generic send_message endpoint is for chat channels only.")
        )

    if thread.channel == "whatsapp":
        from excom.excom.services.whatsapp_service import (
            send_text_message,
            send_media_message,
        )

        if message_type in ("Image", "Video", "Audio", "Document") and media_file:
            result = send_media_message(account, to_number, message_type, media_file, content_text)
        else:
            result = send_text_message(account, to_number, content_text)
        provider_message_id = result.get("provider_message_id", "")
        delivery_status = result.get("status", "Sent")

    now = frappe.utils.now_datetime()
    preview = _make_preview(content_text)

    msg = frappe.get_doc({
        "doctype": "Excom Message",
        "thread": thread_name,
        "omni_identity": thread.omni_identity,
        "channel": thread.channel,
        "account_doctype": account_doctype,
        "account": account_name,
        "direction": "Outbound",
        "message_type": message_type,
        "provider_message_id": provider_message_id,
        "provider_timestamp": now,
        "content_text": content_text,
        "media_file": media_file,
        "delivery_status": delivery_status,
        "created_by_user": frappe.session.user,
        "template": template or None,
        "reply_to": reply_to or None,
    })
    msg.insert(ignore_permissions=True)

    frappe.db.sql(
        """
        UPDATE `tabExcom Thread`
        SET last_message_at = %(now)s,
            last_outbound_at = %(now)s,
            last_message_preview = %(preview)s,
            last_message_direction = 'Outbound',
            modified = %(now)s
        WHERE name = %(thread)s
        """,
        {"now": now, "preview": preview, "thread": thread_name},
    )

    frappe.publish_realtime(
        "excom:message_sent",
        {
            "thread": thread_name,
            "message": msg.name,
            "omni_identity": thread.omni_identity,
            "direction": "Outbound",
            "preview": preview,
            "delivery_status": delivery_status,
        },
        after_commit=True,
    )
    frappe.publish_realtime(
        "excom:thread_updated",
        {"thread": thread_name, "event": "new_outbound"},
        after_commit=True,
    )

    return msg.name


def update_delivery_status(provider_message_id: str, status: str, conversation_id: str = ""):
    """Update delivery status on an Excom Message by provider_message_id."""
    msg = frappe.db.get_value(
        "Excom Message",
        {"provider_message_id": provider_message_id},
        ["name", "thread"],
        as_dict=True,
    )
    if not msg:
        return

    status_map = {
        "sent": "Sent",
        "delivered": "Delivered",
        "read": "Read",
        "failed": "Failed",
    }
    mapped = status_map.get(status, status)

    frappe.db.set_value("Excom Message", msg.name, "delivery_status", mapped)
    frappe.db.commit()

    frappe.publish_realtime(
        "excom:message_status_updated",
        {
            "message": msg.name,
            "thread": msg.thread,
            "status": mapped,
            "provider_message_id": provider_message_id,
        },
    )




def _make_preview(text: str) -> str:
    """Truncate text for thread preview."""
    if not text:
        return ""
    clean = re.sub(r"<[^>]+>", "", text)
    return clean[:120]
