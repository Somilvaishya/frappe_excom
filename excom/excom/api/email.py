"""
Email API endpoints for Excom.

Provides on-demand email body fetching from Gmail (never stored locally),
search delegation to Gmail API, email sending, and connection management.
"""

import json

import frappe
from frappe import _

from excom.excom.services import gmail_service
from excom.excom.channels.email.outbound import send_email_reply


@frappe.whitelist()
def get_email_body(message_name: str):
    """
    Fetch the full email body from Gmail API on-demand.
    The body is returned to the frontend but NEVER written to the database.

    If the email has been deleted from Gmail, returns the stored metadata
    with a 'deleted' flag so the UI can show a graceful notice.

    Args:
        message_name: Excom Message name

    Returns:
        {
            "body_html": "...",
            "body_text": "...",
            "subject": "...",
            "from_email": "...",
            "from_name": "...",
            "to": "...",
            "cc": "...",
            "date": "...",
            "attachments": [...],
            "deleted": false
        }
    """
    msg = frappe.get_doc("Excom Message", message_name)

    if msg.message_type != "Email":
        frappe.throw(_("Message {0} is not an email").format(message_name))

    gmail_msg_id = msg.provider_message_id
    if not gmail_msg_id:
        frappe.throw(_("Message {0} has no Gmail message ID").format(message_name))

    account_name = msg.account

    try:
        content_json = json.loads(msg.content_json or "{}")
    except (json.JSONDecodeError, TypeError):
        content_json = {}

    try:
        full = gmail_service.get_message_full(account_name, gmail_msg_id)
    except Exception as e:
        frappe.log_error(
            title=f"Gmail body fetch failed: {gmail_msg_id}",
            message=str(e),
        )
        return {
            "body_html": "",
            "body_text": "",
            "subject": content_json.get("subject", ""),
            "from_email": content_json.get("from_email", ""),
            "from_name": content_json.get("from_name", ""),
            "to": content_json.get("to", ""),
            "cc": content_json.get("cc", ""),
            "date": content_json.get("date", ""),
            "attachments": [],
            "deleted": True,
            "error": "Failed to fetch from Gmail. The email may have been deleted.",
        }

    if full.get("deleted"):
        return {
            "body_html": "",
            "body_text": "",
            "subject": content_json.get("subject", ""),
            "from_email": content_json.get("from_email", ""),
            "from_name": content_json.get("from_name", ""),
            "to": content_json.get("to", ""),
            "cc": content_json.get("cc", ""),
            "date": content_json.get("date", ""),
            "attachments": [],
            "deleted": True,
            "error": "This email is no longer available in Gmail.",
        }

    return {
        "body_html": full.get("body_html", ""),
        "body_text": full.get("body_text", ""),
        "subject": full.get("headers", {}).get("Subject", content_json.get("subject", "")),
        "from_email": content_json.get("from_email", ""),
        "from_name": content_json.get("from_name", ""),
        "to": full.get("headers", {}).get("To", content_json.get("to", "")),
        "cc": full.get("headers", {}).get("Cc", content_json.get("cc", "")),
        "date": full.get("headers", {}).get("Date", content_json.get("date", "")),
        "attachments": full.get("attachments", []),
        "deleted": False,
    }


@frappe.whitelist()
def get_email_attachment(
    message_name: str,
    attachment_id: str,
    filename: str = "",
) -> None:
    """
    Download an email attachment directly from Gmail API.

    Streams the binary content to the user's browser without saving to the
    Frappe server filesystem. Gmail is the single source of truth.

    Args:
        message_name: Excom Message name
        attachment_id: Gmail attachment ID
        filename: Original filename for the Content-Disposition header
    """
    msg = frappe.get_doc("Excom Message", message_name)
    if msg.message_type != "Email":
        frappe.throw(_("Message {0} is not an email").format(message_name))

    gmail_msg_id = msg.provider_message_id
    account_name = msg.account

    file_bytes = gmail_service.get_attachment(account_name, gmail_msg_id, attachment_id)

    safe_name = (filename or f"attachment_{attachment_id[:8]}").replace('"', "")
    frappe.local.response.filename = safe_name
    frappe.local.response.filecontent = file_bytes
    frappe.local.response.type = "download"


@frappe.whitelist()
def search_emails(account_name: str, query: str, max_results: int = 20):
    """
    Delegate email search to Gmail API using Gmail's native query syntax.
    No local full-text search -- everything goes through Gmail.

    Examples of Gmail query syntax:
        - "from:john@example.com"
        - "subject:invoice"
        - "has:attachment after:2026/01/01"
        - "is:unread"

    Args:
        account_name: Excom Channel Account name
        query: Gmail search query string
        max_results: Maximum number of results

    Returns:
        List of email metadata dicts
    """
    max_results = min(int(max_results), 50)
    results = gmail_service.search_messages(account_name, query, max_results)
    return results


@frappe.whitelist()
def send_email(
    thread_id: str,
    to: str,
    subject: str,
    body_html: str,
    cc: str = "",
    bcc: str = "",
    in_reply_to_gmail_id: str = "",
):
    """
    Send an email reply via Gmail API on an existing email thread.

    Args:
        thread_id: Excom Thread name
        to: Recipient email address
        subject: Email subject
        body_html: HTML body content
        cc: CC recipients
        bcc: BCC recipients
        in_reply_to_gmail_id: Gmail message ID being replied to

    Returns:
        {"success": True, "message_name": "..."}
    """
    try:
        msg_name = send_email_reply(
            thread_name=thread_id,
            to=to,
            subject=subject,
            body_html=body_html,
            cc=cc,
            bcc=bcc,
            in_reply_to_gmail_id=in_reply_to_gmail_id,
        )
        frappe.db.commit()
        return {"success": True, "message_name": msg_name}
    except Exception as e:
        frappe.log_error(
            title="Excom send_email failed",
            message=f"thread_id={thread_id}\n{str(e)}",
        )
        raise


@frappe.whitelist()
def check_gmail_connection(account_name: str):
    """
    Verify Gmail OAuth2 connection is active.

    Returns:
        {"success": True, "email": "user@gmail.com", "historyId": "..."}
    """
    try:
        profile = gmail_service.get_profile(account_name)
        return {
            "success": True,
            "email": profile.get("emailAddress", ""),
            "historyId": profile.get("historyId", ""),
            "messagesTotal": profile.get("messagesTotal", 0),
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


@frappe.whitelist()
def manual_sync(account_name: str):
    """
    Trigger a manual email sync for a specific account.
    Useful for testing or when the scheduler hasn't run yet.
    """
    from excom.excom.channels.email.inbound import poll_single_account

    try:
        poll_single_account(account_name)
        return {"success": True}
    except Exception as e:
        frappe.log_error(title=f"Manual email sync failed: {account_name}")
        return {"success": False, "error": str(e)}
