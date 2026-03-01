"""
Email outbound adapter.

Sends emails via Gmail API and creates Excom Message stubs with
metadata only (no body stored in DB).
"""

import json

import frappe
from frappe import _
from frappe.utils import now_datetime

from excom.excom.services import gmail_service


def send_email_reply(
    thread_name: str,
    to: str,
    subject: str,
    body_html: str,
    cc: str = "",
    bcc: str = "",
    in_reply_to_gmail_id: str = "",
) -> str:
    """
    Send an email reply via Gmail API and create an Excom Message stub.

    Args:
        thread_name: Excom Thread name
        to: Recipient email address
        subject: Email subject
        body_html: HTML body content
        cc: CC recipients
        bcc: BCC recipients
        in_reply_to_gmail_id: Gmail message ID being replied to

    Returns:
        Excom Message name
    """
    thread = frappe.get_doc("Excom Thread", thread_name)

    if thread.channel != "email":
        frappe.throw(_("Thread {0} is not an email thread").format(thread_name))

    account_name = thread.account

    in_reply_to_header = ""
    references_header = ""
    if in_reply_to_gmail_id:
        reply_msg = frappe.db.get_value(
            "Excom Message",
            {"provider_message_id": in_reply_to_gmail_id},
            "content_json",
        )
        if reply_msg:
            try:
                cj = json.loads(reply_msg)
                in_reply_to_header = cj.get("message_id_header", "")
                references_header = in_reply_to_header
            except (json.JSONDecodeError, TypeError):
                pass

    result = gmail_service.send_email(
        account_name=account_name,
        to=to,
        subject=subject,
        body_html=body_html,
        cc=cc,
        bcc=bcc,
        in_reply_to=in_reply_to_header,
        references=references_header,
    )

    gmail_msg_id = result.get("id", "")
    gmail_thread_id = result.get("threadId", "")

    snippet = frappe.utils.strip_html_tags(body_html)[:150]
    preview = f"{subject}: {snippet}"[:120]

    content_json = {
        "gmail_message_id": gmail_msg_id,
        "gmail_thread_id": gmail_thread_id,
        "subject": subject,
        "from_email": frappe.db.get_value(
            "Excom Channel Account", account_name, "email_address"
        ),
        "from_name": "",
        "to": to,
        "cc": cc,
        "date": "",
        "message_id_header": "",
        "in_reply_to": in_reply_to_header,
        "label_ids": result.get("labelIds", []),
        "snippet": snippet,
    }

    now = now_datetime()

    msg = frappe.get_doc({
        "doctype": "Excom Message",
        "thread": thread_name,
        "omni_identity": thread.omni_identity,
        "channel": "email",
        "account_doctype": "Excom Channel Account",
        "account": account_name,
        "direction": "Outbound",
        "message_type": "Email",
        "provider_message_id": gmail_msg_id,
        "provider_timestamp": now,
        "content_text": snippet,
        "content_json": json.dumps(content_json),
        "delivery_status": "Sent",
        "created_by_user": frappe.session.user,
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
            "delivery_status": "Sent",
        },
        after_commit=True,
    )
    frappe.publish_realtime(
        "excom:thread_updated",
        {"thread": thread_name, "event": "new_outbound"},
        after_commit=True,
    )

    return msg.name
