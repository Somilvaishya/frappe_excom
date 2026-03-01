"""
Gmail API service layer for Excom email integration.

Uses Frappe's Connected App OAuth2 infrastructure for authentication.
Gmail is the storage backend -- bodies are NEVER stored in the Frappe database.
Only lightweight metadata pointers (Message-ID, Thread-ID, From, Subject,
Date, snippet) are persisted locally.
"""

import base64
import json
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import requests

import frappe
from frappe import _

GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"


def get_access_token(account_name: str) -> str:
    """
    Retrieves a valid OAuth2 access token for the given Excom Channel Account.
    Uses Frappe Connected App token cache with automatic refresh.

    Args:
        account_name: Excom Channel Account name

    Returns:
        Access token string
    """
    account = frappe.get_doc("Excom Channel Account", account_name)

    if account.channel != "email":
        frappe.throw(_("Account {0} is not an email account").format(account_name))

    if not account.email_connected_app or not account.email_connected_user:
        frappe.throw(
            _("Email account {0} is missing Connected App or Connected User").format(account_name)
        )

    connected_app = frappe.get_doc("Connected App", account.email_connected_app)
    token_cache = connected_app.get_active_token(account.email_connected_user)

    if not token_cache:
        frappe.db.set_value("Excom Channel Account", account_name, "email_authorized", 0)
        frappe.throw(_("No valid OAuth2 token for {0}. Please re-authorize.").format(account_name))

    frappe.db.set_value("Excom Channel Account", account_name, "email_authorized", 1)
    return token_cache.get_password("access_token")


def _headers(account_name: str) -> dict:
    """Build authorization headers for Gmail API requests."""
    token = get_access_token(account_name)
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def get_profile(account_name: str) -> dict:
    """Fetch the authenticated user's Gmail profile to verify connection."""
    resp = requests.get(
        f"{GMAIL_API_BASE}/profile",
        headers=_headers(account_name),
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


def list_messages(
    account_name: str,
    query: str = "",
    label_ids: list = None,
    max_results: int = 50,
    page_token: str = "",
) -> dict:
    """
    List message IDs from Gmail matching a query or label filter.

    Returns:
        {"messages": [{"id": "...", "threadId": "..."}],
         "nextPageToken": "...", "resultSizeEstimate": N}
    """
    params = {"maxResults": max_results}
    if query:
        params["q"] = query
    if label_ids:
        params["labelIds"] = label_ids
    if page_token:
        params["pageToken"] = page_token

    resp = requests.get(
        f"{GMAIL_API_BASE}/messages",
        headers=_headers(account_name),
        params=params,
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def get_message_metadata(account_name: str, message_id: str) -> dict:
    """
    Fetch metadata-only for a single Gmail message.
    Returns headers (From, To, Cc, Subject, Date), snippet, labelIds, threadId.
    Does NOT return the body.
    """
    resp = requests.get(
        f"{GMAIL_API_BASE}/messages/{message_id}",
        headers=_headers(account_name),
        params={
            "format": "metadata",
            "metadataHeaders": [
                "From", "To", "Cc", "Bcc", "Subject",
                "Date", "Message-ID", "In-Reply-To",
            ],
        },
        timeout=15,
    )
    resp.raise_for_status()
    raw = resp.json()

    headers = {}
    for h in raw.get("payload", {}).get("headers", []):
        headers[h["name"]] = h["value"]

    return {
        "id": raw["id"],
        "threadId": raw.get("threadId", ""),
        "labelIds": raw.get("labelIds", []),
        "snippet": raw.get("snippet", "")[:150],
        "internalDate": raw.get("internalDate", ""),
        "headers": headers,
        "sizeEstimate": raw.get("sizeEstimate", 0),
    }


def get_message_full(account_name: str, message_id: str) -> dict:
    """
    Fetch the FULL message from Gmail API -- body + attachments metadata.
    Called ON-DEMAND when an agent opens a specific email. Result is returned
    to the frontend but NEVER persisted to the Frappe database.
    If the message has been deleted from Gmail, returns a deleted marker.
    """
    try:
        resp = requests.get(
            f"{GMAIL_API_BASE}/messages/{message_id}",
            headers=_headers(account_name),
            params={"format": "full"},
            timeout=30,
        )

        if resp.status_code == 404:
            return {
                "id": message_id, "deleted": True,
                "body_html": "", "body_text": "",
                "attachments": [], "headers": {},
            }

        resp.raise_for_status()
    except requests.exceptions.HTTPError as e:
        if "404" in str(e):
            return {
                "id": message_id, "deleted": True,
                "body_html": "", "body_text": "",
                "attachments": [], "headers": {},
            }
        raise

    raw = resp.json()

    headers = {}
    for h in raw.get("payload", {}).get("headers", []):
        headers[h["name"]] = h["value"]

    body_html, body_text = _extract_body(raw.get("payload", {}))
    attachments = _extract_attachments(raw.get("payload", {}))

    return {
        "id": raw["id"],
        "threadId": raw.get("threadId", ""),
        "headers": headers,
        "body_html": body_html,
        "body_text": body_text,
        "attachments": attachments,
        "deleted": False,
    }


def get_attachment(account_name: str, message_id: str, attachment_id: str) -> bytes:
    """Download an attachment from Gmail API. Returns raw bytes."""
    resp = requests.get(
        f"{GMAIL_API_BASE}/messages/{message_id}/attachments/{attachment_id}",
        headers=_headers(account_name),
        timeout=60,
    )
    resp.raise_for_status()
    data = resp.json().get("data", "")
    return base64.urlsafe_b64decode(data)


def send_email(
    account_name: str,
    to: str,
    subject: str,
    body_html: str,
    cc: str = "",
    bcc: str = "",
    in_reply_to: str = "",
    references: str = "",
) -> dict:
    """
    Send an email via Gmail API.

    Returns:
        {"id": "...", "threadId": "...", "labelIds": [...]}
    """
    account = frappe.get_doc("Excom Channel Account", account_name)
    from_email = account.email_address

    msg = MIMEMultipart("alternative")
    msg["From"] = from_email
    msg["To"] = to
    msg["Subject"] = subject
    if cc:
        msg["Cc"] = cc
    if bcc:
        msg["Bcc"] = bcc
    if in_reply_to:
        msg["In-Reply-To"] = in_reply_to
        msg["References"] = references or in_reply_to

    text_part = MIMEText(
        frappe.utils.strip_html_tags(body_html), "plain", "utf-8"
    )
    html_part = MIMEText(body_html, "html", "utf-8")
    msg.attach(text_part)
    msg.attach(html_part)

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("ascii")

    resp = requests.post(
        f"{GMAIL_API_BASE}/messages/send",
        headers=_headers(account_name),
        json={"raw": raw},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def get_history(
    account_name: str,
    start_history_id: str,
    label_id: str = "INBOX",
) -> dict:
    """
    Fetch Gmail history since a given history ID.
    Used for efficient incremental sync.
    """
    params = {
        "startHistoryId": start_history_id,
        "historyTypes": "messageAdded",
    }
    if label_id:
        params["labelId"] = label_id

    resp = requests.get(
        f"{GMAIL_API_BASE}/history",
        headers=_headers(account_name),
        params=params,
        timeout=30,
    )

    if resp.status_code == 404:
        return {
            "history": [],
            "historyId": start_history_id,
            "expired": True,
        }

    resp.raise_for_status()
    return resp.json()


def search_messages(
    account_name: str, query: str, max_results: int = 20
) -> list:
    """
    Delegate search to Gmail API using Gmail's native query syntax.
    Returns a list of message metadata dicts.
    """
    result = list_messages(
        account_name, query=query, max_results=max_results
    )
    messages = result.get("messages", [])

    metadata_list = []
    for msg_ref in messages[:max_results]:
        try:
            meta = get_message_metadata(account_name, msg_ref["id"])
            metadata_list.append(meta)
        except Exception:
            continue

    return metadata_list


def _extract_body(payload: dict) -> tuple:
    """
    Recursively extract HTML and plain text body from a Gmail message payload.

    Returns:
        (body_html, body_text)
    """
    body_html = ""
    body_text = ""

    mime_type = payload.get("mimeType", "")
    body_data = payload.get("body", {}).get("data", "")

    if mime_type == "text/html" and body_data:
        body_html = base64.urlsafe_b64decode(body_data).decode(
            "utf-8", errors="replace"
        )
    elif mime_type == "text/plain" and body_data:
        body_text = base64.urlsafe_b64decode(body_data).decode(
            "utf-8", errors="replace"
        )

    for part in payload.get("parts", []):
        part_html, part_text = _extract_body(part)
        if part_html and not body_html:
            body_html = part_html
        if part_text and not body_text:
            body_text = part_text

    return body_html, body_text


def _extract_attachments(payload: dict) -> list:
    """
    Extract attachment metadata from a Gmail message payload.

    Returns:
        list of {filename, mimeType, size, attachmentId}
    """
    attachments = []

    body = payload.get("body", {})
    if body.get("attachmentId"):
        attachments.append({
            "filename": payload.get("filename", ""),
            "mimeType": payload.get("mimeType", ""),
            "size": body.get("size", 0),
            "attachmentId": body["attachmentId"],
        })

    for part in payload.get("parts", []):
        attachments.extend(_extract_attachments(part))

    return [a for a in attachments if a.get("filename")]
