import frappe
from frappe import _

from excom.excom.services.thread_service import send_outbound_message


@frappe.whitelist()
def get_threads(search: str = "", limit: int = 50, offset: int = 0):
    """
    Inbox query: returns threads ordered by last_message_at.
    Zero joins, zero subqueries -- reads directly from Excom Thread.
    """
    limit = int(limit)
    offset = int(offset)

    conditions = "status != 'Closed'"
    params = {"limit": limit, "offset": offset}

    if search:
        conditions += " AND (display_name LIKE %(search)s OR primary_phone LIKE %(search)s)"
        params["search"] = f"%{search}%"

    threads = frappe.db.sql(
        f"""
        SELECT name, display_name, primary_phone, last_message_at,
               last_message_preview, last_message_direction, unread_count,
               status, assigned_to, omni_identity, channel, account
        FROM `tabExcom Thread`
        WHERE {conditions}
        ORDER BY last_message_at DESC
        LIMIT %(limit)s OFFSET %(offset)s
        """,
        params,
        as_dict=True,
    )

    return threads


@frappe.whitelist()
def get_messages(thread_id: str, limit: int = 50, before: str = ""):
    """Load messages for a thread, ordered chronologically."""
    limit = int(limit)
    params = {"thread": thread_id, "limit": limit}

    conditions = "m.thread = %(thread)s"
    if before:
        conditions += " AND m.creation < %(before)s"
        params["before"] = before

    messages = frappe.db.sql(
        f"""
        SELECT m.name, m.direction, m.message_type, m.content_text,
               m.media_file, m.delivery_status, m.creation,
               m.provider_message_id, m.reply_to,
               m.created_by_user, u.full_name AS sender_name
        FROM `tabExcom Message` m
        LEFT JOIN `tabUser` u ON u.name = m.created_by_user
        WHERE {conditions}
        ORDER BY m.creation ASC
        LIMIT %(limit)s
        """,
        params,
        as_dict=True,
    )

    return messages


@frappe.whitelist()
def send_message(thread_id: str, message: str):
    """Send a text message on an existing thread."""
    try:
        msg_name = send_outbound_message(
            thread_name=thread_id,
            content_text=message,
            message_type="Text",
        )
        frappe.db.commit()
        return {"success": True, "message_name": msg_name}
    except Exception as e:
        frappe.log_error(
            title="Excom send_message failed",
            message=f"thread_id={thread_id}\n{str(e)}",
        )
        raise


@frappe.whitelist()
def mark_read(thread_id: str):
    """Reset unread count for a thread."""
    frappe.db.set_value("Excom Thread", thread_id, "unread_count", 0)
    return {"success": True}


@frappe.whitelist()
def get_linked_entities(omni_identity: str):
    """
    Fetch all linked ERP entities from the Omni Identity's linked_entities child table.
    Returns list of {linked_doctype, linked_name, role, title} for display in the sidebar.
    """
    if not omni_identity or not frappe.db.exists("Omni Identity", omni_identity):
        return []

    links = frappe.get_all(
        "Omni Identity Link",
        filters={"parent": omni_identity},
        fields=["linked_doctype", "linked_name", "role"],
        order_by="creation desc",
    )

    result = []
    for link in links:
        title = link.linked_name
        try:
            doc = frappe.get_cached_doc(link.linked_doctype, link.linked_name)
            title = (
                getattr(doc, "customer_name", None)
                or getattr(doc, "lead_name", None)
                or getattr(doc, "company_name", None)
                or getattr(doc, "supplier_name", None)
                or (
                    (getattr(doc, "first_name", None) or "")
                    + " "
                    + (getattr(doc, "last_name", None) or "")
                ).strip()
                or getattr(doc, "email_id", None)
            )
        except Exception:
            pass
        result.append(
            {
                "linked_doctype": link.linked_doctype,
                "linked_name": link.linked_name,
                "role": link.role or "Unknown",
                "title": str(title).strip() if title else link.linked_name,
            }
        )
    return result
