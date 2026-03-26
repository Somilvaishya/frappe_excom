"""
WhatsApp Message Service — single entry point for all WhatsApp API operations.

All outbound and inbound WhatsApp flows should route through this service
so that rate limiting, retries, circuit-breaking, and audit logging can be
added as middleware without touching callers.
"""

import json
import re

import frappe
import requests as http_requests
from frappe import _
from frappe.utils import now_datetime
from frappe.utils.password import get_decrypted_password

from excom.excom.utils.errors import ExcomProviderError, ExcomRateLimitError


def send_text_message(account, to: str, content: str) -> dict:
    """
    Send a plain text WhatsApp message.

    Args:
        account: Excom Channel Account doc
        to: Recipient phone number (E.164)
        content: Message body text

    Returns:
        dict with keys: provider_message_id, status
    """
    to = _clean_phone(to)
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": content},
    }
    return _call_api(account, payload)


def send_template_message(account, to: str, template_name: str, language_code: str,
                          components: list = None) -> dict:
    """
    Send a template WhatsApp message.

    Args:
        account: Account doc
        to: Recipient phone (E.164)
        template_name: The actual_name registered with Meta
        language_code: e.g. "en_US"
        components: Template component parameters list

    Returns:
        dict with keys: provider_message_id, status
    """
    to = _clean_phone(to)
    template_block: dict = {
        "name": template_name,
        "language": {"code": language_code},
    }
    if components:
        template_block["components"] = components
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "template",
        "template": template_block,
    }
    return _call_api(account, payload)


def send_media_message(account, to: str, media_type: str, file_url: str,
                       caption: str = "") -> dict:
    """
    Send a media WhatsApp message (image, video, audio, document).

    Args:
        account: Account doc
        to: Recipient phone (E.164)
        media_type: One of "image", "video", "audio", "document"
        file_url: Public URL or Frappe file path
        caption: Optional caption (not supported for audio)

    Returns:
        dict with keys: provider_message_id, status
    """
    to = _clean_phone(to)
    if file_url.startswith("http"):
        link = file_url
    else:
        from excom.excom.api.chat import _get_site_url
        link = _get_site_url() + file_url
    media_key = media_type.lower()

    media_obj = {"link": link}
    if caption and media_key != "audio":
        media_obj["caption"] = caption

    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": media_key,
        media_key: media_obj,
    }
    return _call_api(account, payload)


def wa_update_delivery_status(provider_message_id: str, status: str, timestamp: str = ""):
    """
    Update delivery status on the legacy WhatsApp Message DocType.
    Also populates lifecycle timestamp fields (sent_at, delivered_at, etc.).

    Args:
        provider_message_id: The wamid from Meta
        status: One of "sent", "delivered", "read", "failed"
        timestamp: ISO timestamp from the webhook (optional)
    """
    name = frappe.db.get_value(
        "WhatsApp Message", {"message_id": provider_message_id}, "name"
    )
    if not name:
        return

    now = timestamp or now_datetime()
    status_lower = status.lower() if status else ""

    updates = {"status": status_lower}
    ts_field_map = {
        "sent": "sent_at",
        "delivered": "delivered_at",
        "read": "read_at",
        "failed": "failed_at",
    }
    ts_field = ts_field_map.get(status_lower)
    if ts_field:
        updates[ts_field] = now

    frappe.db.set_value("WhatsApp Message", name, updates, update_modified=False)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _resolve_credentials(account):
    """Extract token, base_url, version, phone_id from Excom Channel Account."""
    token = None
    try:
        token = account.get_password("wa_token")
    except Exception:
        pass
    if not token:
        token = get_decrypted_password(
            account.doctype, account.name, "wa_token", raise_exception=False
        )
    if not token:
        raise ExcomProviderError(
            f"No access token for account {account.name}",
            provider="whatsapp",
        )

    base_url = getattr(account, "wa_url", None) or "https://graph.facebook.com"
    version = getattr(account, "wa_version", None) or "v21.0"
    phone_id = getattr(account, "wa_phone_id", None)
    if not phone_id:
        raise ExcomProviderError(
            f"No Phone Number ID for account {account.name}",
            provider="whatsapp",
        )

    return token, base_url, version, phone_id


def _call_api(account, payload: dict) -> dict:
    """
    Make the actual HTTP POST to Meta's WhatsApp Cloud API.

    Returns:
        dict with provider_message_id and status
    """
    token, base_url, version, phone_id = _resolve_credentials(account)
    url = f"{base_url}/{version}/{phone_id}/messages"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    response = http_requests.post(url, json=payload, headers=headers)
    data = response.json()

    if response.ok and data.get("messages"):
        return {
            "provider_message_id": data["messages"][0].get("id", ""),
            "status": "Sent",
        }

    error = data.get("error", {})
    error_msg = error.get("message", "Unknown error")
    error_code = error.get("code")

    if error_code == 130429 or response.status_code == 429:
        raise ExcomRateLimitError(
            f"Rate limit exceeded: {error_msg}",
            provider="whatsapp",
            retry_after=int(error.get("retry_after", 60)),
        )

    if "expired" in error_msg.lower() or error_code in (190, 102):
        raise ExcomProviderError(
            f"WhatsApp API auth error: {error_msg}. Update the access token for {account.name}.",
            provider="whatsapp",
        )

    raise ExcomProviderError(
        f"WhatsApp API error ({error_code}): {error_msg}",
        provider="whatsapp",
    )


def _clean_phone(number: str) -> str:
    """Strip non-digit characters for the API payload."""
    return re.sub(r"[^\d]", "", number)
