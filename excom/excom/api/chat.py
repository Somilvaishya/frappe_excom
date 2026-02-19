import frappe
from frappe import _


@frappe.whitelist()
def get_contacts(search: str = "", limit: int = 50, offset: int = 0):
    """Get WhatsApp profiles with last message info for the chat sidebar."""
    filters = {}
    if search:
        filters["profile_name"] = ["like", f"%{search}%"]

    profiles = frappe.get_all(
        "WhatsApp Profiles",
        filters=filters,
        fields=["name", "profile_name", "number", "contact", "title", "whatsapp_account"],
        order_by="modified desc",
        limit_page_length=limit,
        start=offset,
    )

    for profile in profiles:
        last_msg = frappe.db.sql(
            """
            SELECT message, creation, type, content_type, status
            FROM `tabWhatsApp Message`
            WHERE `to` = %(number)s OR `from` = %(number)s
            ORDER BY creation DESC
            LIMIT 1
            """,
            {"number": profile.number},
            as_dict=True,
        )

        if last_msg:
            profile["last_message"] = _strip_html(last_msg[0].get("message") or "")
            profile["last_message_time"] = str(last_msg[0].get("creation"))
            profile["last_message_type"] = last_msg[0].get("type")
        else:
            profile["last_message"] = ""
            profile["last_message_time"] = ""
            profile["last_message_type"] = ""

        unread = frappe.db.sql(
            """
            SELECT COUNT(*) as cnt FROM `tabWhatsApp Message`
            WHERE `from` = %(number)s AND type = 'Incoming'
            AND status NOT IN ('read', 'marked as read')
            """,
            {"number": profile.number},
            as_dict=True,
        )
        profile["unread_count"] = unread[0].cnt if unread else 0

    profiles.sort(key=lambda p: p.get("last_message_time") or "", reverse=True)

    return profiles


@frappe.whitelist()
def get_messages(profile_id: str, limit: int = 50, before: str = ""):
    """Get messages for a specific WhatsApp profile."""
    profile = frappe.get_doc("WhatsApp Profiles", profile_id)
    number = profile.number
    limit = int(limit)

    conditions = "(m.`to` = %(number)s OR m.`from` = %(number)s)"
    params = {"number": number, "limit": limit}

    if before:
        conditions += " AND m.creation < %(before)s"
        params["before"] = before

    messages = frappe.db.sql(
        f"""
        SELECT m.name, m.type, m.status, m.`to`, m.`from`, m.message,
               m.content_type, m.message_type, m.creation, m.is_reply,
               m.reply_to_message_id, m.owner,
               u.full_name AS sender_name
        FROM `tabWhatsApp Message` m
        LEFT JOIN `tabUser` u ON u.name = m.owner
        WHERE {conditions}
        ORDER BY m.creation ASC
        LIMIT %(limit)s
        """,
        params,
        as_dict=True,
    )

    return messages


@frappe.whitelist()
def send_message(profile_id: str, message: str):
    """Send a text message to a WhatsApp profile (within 24h window)."""
    profile = frappe.get_doc("WhatsApp Profiles", profile_id)
    account_name = profile.whatsapp_account

    if not account_name:
        settings = frappe.get_single("WhatsApp Settings")
        account_name = settings.default_outgoing_account

    if not account_name:
        frappe.throw(_("No WhatsApp Account configured for this profile"))

    account = frappe.get_doc("WhatsApp Account", account_name)

    import requests as http_requests

    url = f"{account.url}/{account.version}/{account.phone_id}/messages"
    headers = {
        "Authorization": f"Bearer {account.get_password('token')}",
        "Content-Type": "application/json",
    }

    payload = {
        "messaging_product": "whatsapp",
        "to": profile.number,
        "type": "text",
        "text": {"body": message},
    }

    response = http_requests.post(url, json=payload, headers=headers)
    data = response.json()

    if response.ok and data.get("messages"):
        msg_id = data["messages"][0].get("id", "")
        doc = frappe.get_doc(
            {
                "doctype": "WhatsApp Message",
                "type": "Outgoing",
                "message": message,
                "to": profile.number,
                "message_id": msg_id,
                "content_type": "text",
                "message_type": "Manual",
                "status": "sent",
                "whatsapp_account": account.name,
            }
        )
        doc.insert(ignore_permissions=True)
        frappe.db.commit()
        return {"success": True, "message_id": msg_id, "doc_name": doc.name}
    else:
        error = data.get("error", {}).get("message", "Unknown error")
        frappe.throw(_(f"Failed to send message: {error}"))


def _strip_html(html: str) -> str:
    """Remove HTML tags for preview text."""
    import re
    clean = re.sub(r"<[^>]+>", "", html or "")
    return clean[:100]
