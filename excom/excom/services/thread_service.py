"""
Core service layer for Excom Thread and Message operations.

All inbound/outbound message flows route through here to guarantee
consistent thread state, idempotency, and identity resolution.
"""

import json
import re

import frappe
import requests as http_requests
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

    return msg.name


def send_outbound_message(
    thread_name: str,
    content_text: str,
    message_type: str = "Text",
    media_file: str = "",
    template: str = "",
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

    account = _resolve_thread_account(thread)

    provider_message_id = ""
    delivery_status = "Queued"

    if thread.channel == "whatsapp":
        provider_message_id, delivery_status = _send_whatsapp(
            account, to_number, content_text, message_type, media_file,
        )

    now = frappe.utils.now_datetime()
    preview = _make_preview(content_text)

    msg = frappe.get_doc({
        "doctype": "Excom Message",
        "thread": thread_name,
        "omni_identity": thread.omni_identity,
        "channel": thread.channel,
        "account_doctype": thread.account_doctype,
        "account": thread.account,
        "direction": "Outbound",
        "message_type": message_type,
        "provider_message_id": provider_message_id,
        "provider_timestamp": now,
        "content_text": content_text,
        "media_file": media_file,
        "delivery_status": delivery_status,
        "created_by_user": frappe.session.user,
        "template": template or None,
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

    return msg.name


def update_delivery_status(provider_message_id: str, status: str, conversation_id: str = ""):
    """Update delivery status on an Excom Message by provider_message_id."""
    name = frappe.db.get_value(
        "Excom Message",
        {"provider_message_id": provider_message_id},
        "name",
    )
    if not name:
        return

    status_map = {
        "sent": "Sent",
        "delivered": "Delivered",
        "read": "Read",
        "failed": "Failed",
    }
    mapped = status_map.get(status, status)

    frappe.db.set_value("Excom Message", name, "delivery_status", mapped)


def _send_whatsapp(account, to_number: str, text: str, message_type: str, media_file: str):
    """Call WhatsApp Cloud API. Returns (provider_message_id, delivery_status)."""
    # Support both Excom Channel Account fields and legacy WhatsApp Account fields.
    token_field = "wa_token" if account.doctype == "Excom Channel Account" else "token"
    token = account.get_password(token_field)
    base_url = account.get("wa_url") or account.get("url")
    version = account.get("wa_version") or account.get("version")
    phone_id = account.get("wa_phone_id") or account.get("phone_id")

    if not token or not base_url or not version or not phone_id:
        frappe.throw(_("Missing WhatsApp account configuration (token/url/version/phone_id)"))

    url = f"{base_url}/{version}/{phone_id}/messages"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    to_number = re.sub(r"[^\d]", "", to_number)

    if message_type in ("Image", "Video", "Audio", "Document") and media_file:
        link = media_file if media_file.startswith("http") else frappe.utils.get_url() + media_file
        content_key = message_type.lower()
        payload = {
            "messaging_product": "whatsapp",
            "to": to_number,
            "type": content_key,
            content_key: {"link": link, "caption": text} if content_key != "audio" else {"link": link},
        }
    else:
        payload = {
            "messaging_product": "whatsapp",
            "to": to_number,
            "type": "text",
            "text": {"body": text},
        }

    response = http_requests.post(url, json=payload, headers=headers)
    data = response.json()

    if response.ok and data.get("messages"):
        return data["messages"][0].get("id", ""), "Sent"

    error = data.get("error", {}).get("message", "Unknown error")
    frappe.throw(_(f"WhatsApp API error: {error}"))


def _make_preview(text: str) -> str:
    """Truncate text for thread preview."""
    if not text:
        return ""
    clean = re.sub(r"<[^>]+>", "", text)
    return clean[:120]


def _resolve_thread_account(thread):
    """
    Resolve account doc for a thread with backward compatibility.
    If thread still points to legacy WhatsApp Account but a matching
    Excom Channel Account exists, self-heal the thread reference.
    """
    if thread.account_doctype == "Excom Channel Account":
        return frappe.get_doc("Excom Channel Account", thread.account)

    mapped = frappe.db.exists("Excom Channel Account", thread.account)
    if mapped:
        frappe.db.set_value(
            "Excom Thread",
            thread.name,
            {"account_doctype": "Excom Channel Account", "account": mapped},
        )
        thread.account_doctype = "Excom Channel Account"
        thread.account = mapped
        return frappe.get_doc("Excom Channel Account", mapped)

    return frappe.get_doc(thread.account_doctype, thread.account)
