import json

import frappe
from frappe import _
from frappe.utils import flt, now_datetime

from excom.excom.services.thread_service import send_outbound_message


@frappe.whitelist()
def get_threads(search: str = "", limit: int = 50, offset: int = 0):
    """
    Inbox query: returns threads ordered by last_message_at.
    Enriches each thread with contact data from Omni Identity and User.
    """
    limit = int(limit)
    offset = int(offset)

    conditions = "t.status != 'Closed'"
    params = {"limit": limit, "offset": offset}

    if search:
        conditions += " AND (t.display_name LIKE %(search)s OR t.primary_phone LIKE %(search)s)"
        params["search"] = f"%{search}%"

    threads = frappe.db.sql(
        f"""
        SELECT t.name, t.display_name, t.primary_phone, t.last_message_at,
               t.last_message_preview, t.last_message_direction, t.unread_count,
               t.status, t.assigned_to, t.omni_identity, t.channel, t.account,
               oi.primary_email,
               u.full_name AS assigned_to_name, u.user_image AS assigned_to_avatar
        FROM `tabExcom Thread` t
        LEFT JOIN `tabOmni Identity` oi ON oi.name = t.omni_identity
        LEFT JOIN `tabUser` u ON u.name = t.assigned_to
        WHERE {conditions}
        ORDER BY t.last_message_at DESC
        LIMIT %(limit)s OFFSET %(offset)s
        """,
        params,
        as_dict=True,
    )

    if threads:
        _enrich_company(threads)
        _enrich_tags(threads)

    return threads


def _enrich_company(threads: list):
    """
    Batch-fetch company from linked Contact/Lead for each unique omni_identity.
    Avoids N+1 by fetching all at once.
    """
    identity_names = list({t.omni_identity for t in threads if t.get("omni_identity")})
    if not identity_names:
        return

    links = frappe.db.sql(
        """
        SELECT parent, linked_doctype, linked_name
        FROM `tabOmni Identity Link`
        WHERE parent IN %(ids)s AND linked_doctype IN ('Contact', 'Lead', 'Customer')
        ORDER BY parent, creation ASC
        """,
        {"ids": identity_names},
        as_dict=True,
    )

    identity_company = {}
    for link in links:
        if link.parent in identity_company:
            continue
        company = None
        if link.linked_doctype == "Customer":
            company = frappe.db.get_value("Customer", link.linked_name, "customer_name")
        elif link.linked_doctype == "Lead":
            company = frappe.db.get_value("Lead", link.linked_name, "company_name")
        elif link.linked_doctype == "Contact":
            company = frappe.db.get_value("Contact", link.linked_name, "company_name")
        if company:
            identity_company[link.parent] = company

    for t in threads:
        t["company"] = identity_company.get(t.get("omni_identity"), "")


def _enrich_tags(threads: list):
    """Batch-fetch tags for all threads in one query."""
    thread_names = [t.name for t in threads]
    if not thread_names:
        return

    tag_rows = frappe.db.sql(
        """
        SELECT tt.parent, tt.tag, t.color, t.tag_name
        FROM `tabExcom Thread Tag` tt
        JOIN `tabExcom Tag` t ON t.name = tt.tag
        WHERE tt.parent IN %(names)s
        ORDER BY tt.added_on ASC
        """,
        {"names": thread_names},
        as_dict=True,
    )

    thread_tags: dict = {}
    for row in tag_rows:
        thread_tags.setdefault(row.parent, []).append({
            "tag": row.tag,
            "tag_name": row.tag_name,
            "color": row.color,
        })

    for t in threads:
        t["tags"] = thread_tags.get(t.name, [])


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
               m.created_by_user, m.is_internal,
               m.is_pinned, m.pinned_by, m.reactions,
               CASE WHEN m.message_type = 'Email' THEN m.content_json ELSE NULL END AS content_json,
               u.full_name AS sender_name,
               rt.content_text AS reply_to_content,
               rt.direction AS reply_to_direction,
               ru.full_name AS reply_to_sender
        FROM `tabExcom Message` m
        LEFT JOIN `tabUser` u ON u.name = m.created_by_user
        LEFT JOIN `tabExcom Message` rt ON rt.name = m.reply_to
        LEFT JOIN `tabUser` ru ON ru.name = rt.created_by_user
        WHERE {conditions}
        ORDER BY m.creation ASC
        LIMIT %(limit)s
        """,
        params,
        as_dict=True,
    )

    for msg in messages:
        if msg.reactions and isinstance(msg.reactions, str):
            try:
                msg.reactions = json.loads(msg.reactions)
            except (json.JSONDecodeError, TypeError):
                msg.reactions = {}

    return messages


@frappe.whitelist()
def send_message(thread_id: str, message: str = "", message_type: str = "Text",
                 media_url: str = "", reply_to: str = ""):
    """
    Send a message on an existing thread.

    Args:
        thread_id: Excom Thread name
        message: Text content (required for Text, optional caption for media)
        message_type: Text | Image | Video | Audio | Document
        media_url: Frappe file URL for media messages
        reply_to: Excom Message name being replied to
    """
    try:
        msg_name = send_outbound_message(
            thread_name=thread_id,
            content_text=message,
            message_type=message_type,
            media_file=media_url,
            reply_to=reply_to,
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


@frappe.whitelist()
def get_conversation_stats(omni_identity: str):
    """
    Returns real conversation statistics across ALL threads for an Omni Identity:
    - total_messages: total Excom Message count
    - inbound_count / outbound_count: breakdown by direction
    - erp_users_replied: whether any ERP user has sent an outbound message
    - avg_response_time_seconds: average seconds between an inbound message
      and the next outbound reply (calculated per-thread, then averaged)
    - channels: list of distinct channels used
    """
    empty = {
        "total_messages": 0,
        "inbound_count": 0,
        "outbound_count": 0,
        "erp_users_replied": False,
        "avg_response_time_seconds": None,
        "channels": [],
    }

    if not omni_identity:
        return empty

    thread_names = frappe.get_all(
        "Excom Thread",
        filters={"omni_identity": omni_identity},
        pluck="name",
    )

    if not thread_names:
        return empty

    channels = list(set(
        frappe.get_all(
            "Excom Thread",
            filters={"name": ["in", thread_names]},
            pluck="channel",
        )
    ))

    messages = frappe.db.sql(
        """
        SELECT direction, creation, thread
        FROM `tabExcom Message`
        WHERE thread IN %(threads)s
        ORDER BY thread, creation ASC
        """,
        {"threads": thread_names},
        as_dict=True,
    )

    total = len(messages)
    inbound = sum(1 for m in messages if m.direction == "Inbound")
    outbound = sum(1 for m in messages if m.direction == "Outbound")
    erp_replied = outbound > 0

    response_times = []
    last_inbound_at = None
    current_thread = None
    for m in messages:
        if m.thread != current_thread:
            current_thread = m.thread
            last_inbound_at = None
        if m.direction == "Inbound":
            last_inbound_at = m.creation
        elif m.direction == "Outbound" and last_inbound_at is not None:
            delta = (m.creation - last_inbound_at).total_seconds()
            response_times.append(delta)
            last_inbound_at = None

    avg_response = None
    if response_times:
        avg_response = flt(sum(response_times) / len(response_times), 0)

    return {
        "total_messages": total,
        "inbound_count": inbound,
        "outbound_count": outbound,
        "erp_users_replied": erp_replied,
        "avg_response_time_seconds": avg_response,
        "channels": channels,
    }


@frappe.whitelist()
def get_ai_suggestions(thread_id: str, force_refresh: bool = False):
    """
    Returns AI suggestions for a thread.
    Phase 2 stub: computes basic insights from message history.
    Full LLM integration deferred to Phase 5.
    """
    if not thread_id or not frappe.db.exists("Excom Thread", thread_id):
        return _empty_ai_response()

    thread = frappe.db.get_value(
        "Excom Thread", thread_id,
        ["omni_identity", "last_message_at", "display_name"],
        as_dict=True,
    )

    messages = frappe.db.sql(
        """
        SELECT direction, creation, content_text
        FROM `tabExcom Message`
        WHERE thread = %(thread)s
        ORDER BY creation DESC
        LIMIT 50
        """,
        {"thread": thread_id},
        as_dict=True,
    )

    total = len(messages)
    inbound = [m for m in messages if m.direction == "Inbound"]
    outbound = [m for m in messages if m.direction == "Outbound"]

    suggested_replies = []
    if outbound:
        seen = set()
        for m in outbound[:10]:
            text = (m.content_text or "").strip()
            if text and len(text) > 10 and text not in seen:
                seen.add(text)
                suggested_replies.append({"text": text, "confidence": 0.7})
            if len(suggested_replies) >= 3:
                break

    summary_text = f"{total} messages exchanged"
    if thread.last_message_at:
        summary_text += f". Last activity: {thread.last_message_at}"

    response_times = []
    sorted_msgs = sorted(messages, key=lambda m: m.creation)
    last_inbound_at = None
    for m in sorted_msgs:
        if m.direction == "Inbound":
            last_inbound_at = m.creation
        elif m.direction == "Outbound" and last_inbound_at:
            response_times.append((m.creation - last_inbound_at).total_seconds())
            last_inbound_at = None

    avg_rt = sum(response_times) / len(response_times) if response_times else None
    best_time = "Unknown"
    if inbound:
        hours = [m.creation.hour for m in inbound]
        from collections import Counter
        most_common_hour = Counter(hours).most_common(1)[0][0]
        best_time = f"{most_common_hour}:00 - {most_common_hour + 1}:00"

    next_actions = _get_next_actions(thread.omni_identity)

    return {
        "suggested_replies": suggested_replies,
        "summary": {
            "text": summary_text,
            "updated_at": str(now_datetime()),
            "sentiment": "neutral",
        },
        "next_actions": next_actions,
        "insights": {
            "response_pattern": f"~{int(avg_rt / 60)}m avg reply time" if avg_rt else "Not enough data",
            "engagement_rate": round(len(outbound) / max(len(inbound), 1), 2) if inbound else 0,
            "best_contact_time": best_time,
        },
    }


def _empty_ai_response():
    return {
        "suggested_replies": [],
        "summary": {"text": "No data available", "updated_at": "", "sentiment": "neutral"},
        "next_actions": [],
        "insights": {"response_pattern": "—", "engagement_rate": 0, "best_contact_time": "—"},
    }


def _get_next_actions(omni_identity: str):
    """Derive next actions from linked ERP entity statuses."""
    actions = []
    if not omni_identity:
        return actions

    links = frappe.get_all(
        "Omni Identity Link",
        filters={"parent": omni_identity},
        fields=["linked_doctype", "linked_name"],
        limit=5,
    )

    for link in links:
        dt, dn = link.linked_doctype, link.linked_name
        if dt == "Lead":
            status = frappe.db.get_value("Lead", dn, "status")
            if status in ("Lead", "Open"):
                actions.append({"action": f"Follow up on Lead {dn}", "priority": "high", "due": ""})
        elif dt == "Customer":
            actions.append({"action": f"Review Customer {dn} account", "priority": "low", "due": ""})

    return actions[:3]


@frappe.whitelist()
def assign_thread(thread_id: str, user: str = ""):
    """
    Assign a thread to the current user or a specified user.
    Used by the "Take Over" button.
    """
    if not user:
        user = frappe.session.user

    frappe.db.set_value("Excom Thread", thread_id, "assigned_to", user)
    frappe.publish_realtime(
        "excom:thread_updated",
        {"thread": thread_id, "event": "assigned"},
        after_commit=True,
    )
    return {"success": True, "assigned_to": user}


@frappe.whitelist()
def get_response_metrics(omni_identity: str):
    """
    Calculates average response time for an Omni Identity.
    Time between last inbound and next outbound per thread.
    """
    if not omni_identity:
        return {"avg_response_time_seconds": None}

    thread_names = frappe.get_all(
        "Excom Thread",
        filters={"omni_identity": omni_identity},
        pluck="name",
    )
    if not thread_names:
        return {"avg_response_time_seconds": None}

    messages = frappe.db.sql(
        """
        SELECT direction, creation, thread
        FROM `tabExcom Message`
        WHERE thread IN %(threads)s
        ORDER BY thread, creation ASC
        """,
        {"threads": thread_names},
        as_dict=True,
    )

    response_times = []
    last_inbound_at = None
    current_thread = None
    for m in messages:
        if m.thread != current_thread:
            current_thread = m.thread
            last_inbound_at = None
        if m.direction == "Inbound":
            last_inbound_at = m.creation
        elif m.direction == "Outbound" and last_inbound_at:
            response_times.append((m.creation - last_inbound_at).total_seconds())
            last_inbound_at = None

    avg = flt(sum(response_times) / len(response_times), 0) if response_times else None
    return {"avg_response_time_seconds": avg}


@frappe.whitelist()
def get_canned_responses(search: str = "", channel: str = ""):
    """
    Returns canned responses filtered by search text and channel.
    Includes global responses and current user's personal ones.
    """
    filters = [
        ["is_global", "=", 1],
    ]

    user_filters = [
        ["is_global", "=", 0],
        ["owner", "=", frappe.session.user],
    ]

    fields = ["name", "title", "shortcode", "content", "category", "channel"]

    global_responses = frappe.get_all(
        "Excom Canned Response",
        filters=filters,
        fields=fields,
        order_by="title asc",
        limit=50,
    )

    personal_responses = frappe.get_all(
        "Excom Canned Response",
        filters=user_filters,
        fields=fields,
        order_by="title asc",
        limit=50,
    )

    all_responses = global_responses + personal_responses

    if channel and channel != "All":
        all_responses = [
            r for r in all_responses
            if r.channel in ("All", channel)
        ]

    if search:
        q = search.lower()
        all_responses = [
            r for r in all_responses
            if q in (r.title or "").lower()
            or q in (r.shortcode or "").lower()
            or q in (r.content or "").lower()
        ]

    return all_responses


@frappe.whitelist()
def send_internal_note(thread_id: str, content: str):
    """
    Creates an internal note on a thread visible only to agents.
    Does NOT send anything to the customer via any channel.

    Args:
        thread_id: Excom Thread name
        content: Note text
    """
    if not content or not content.strip():
        frappe.throw(_("Note content cannot be empty"))

    thread = frappe.get_doc("Excom Thread", thread_id)

    msg = frappe.get_doc({
        "doctype": "Excom Message",
        "thread": thread_id,
        "omni_identity": thread.omni_identity,
        "direction": "Outbound",
        "message_type": "Text",
        "channel": thread.channel,
        "account_doctype": thread.account_doctype,
        "account": thread.account,
        "delivery_status": "Read",
        "content_text": content.strip(),
        "is_internal": 1,
        "created_by_user": frappe.session.user,
    })
    msg.insert(ignore_permissions=True)

    frappe.publish_realtime(
        "excom:message_received",
        {
            "thread": thread_id,
            "message": msg.name,
            "omni_identity": thread.omni_identity,
            "direction": "Outbound",
            "preview": content.strip()[:100],
            "is_internal": True,
        },
        after_commit=True,
    )

    frappe.db.commit()

    return {"success": True, "message_name": msg.name}


@frappe.whitelist()
def pin_message(message_name: str):
    """Pin a message. Sets is_pinned=1 and pinned_by to current user."""
    if not frappe.db.exists("Excom Message", message_name):
        frappe.throw(_("Message not found"))
    frappe.db.set_value("Excom Message", message_name, {
        "is_pinned": 1,
        "pinned_by": frappe.session.user,
    })
    thread = frappe.db.get_value("Excom Message", message_name, "thread")
    frappe.publish_realtime("excom:message_pinned", {
        "message": message_name, "thread": thread, "pinned": True,
    }, after_commit=True)
    return {"success": True}


@frappe.whitelist()
def unpin_message(message_name: str):
    """Unpin a message."""
    if not frappe.db.exists("Excom Message", message_name):
        frappe.throw(_("Message not found"))
    frappe.db.set_value("Excom Message", message_name, {
        "is_pinned": 0,
        "pinned_by": "",
    })
    thread = frappe.db.get_value("Excom Message", message_name, "thread")
    frappe.publish_realtime("excom:message_pinned", {
        "message": message_name, "thread": thread, "pinned": False,
    }, after_commit=True)
    return {"success": True}


@frappe.whitelist()
def get_pinned_messages(thread_id: str):
    """Return all pinned messages for a thread."""
    return frappe.db.sql(
        """
        SELECT m.name, m.content_text, m.direction, m.creation,
               m.message_type, m.created_by_user,
               u.full_name AS sender_name
        FROM `tabExcom Message` m
        LEFT JOIN `tabUser` u ON u.name = m.created_by_user
        WHERE m.thread = %(thread)s AND m.is_pinned = 1
        ORDER BY m.creation DESC
        """,
        {"thread": thread_id},
        as_dict=True,
    )


@frappe.whitelist()
def toggle_reaction(message_name: str, emoji: str):
    """
    Toggle the current user's reaction on a message.
    Reactions stored as JSON: {"emoji": ["user1", "user2"]}.
    """
    if not frappe.db.exists("Excom Message", message_name):
        frappe.throw(_("Message not found"))

    raw = frappe.db.get_value("Excom Message", message_name, "reactions") or "{}"
    try:
        reactions = json.loads(raw) if isinstance(raw, str) else (raw or {})
    except (json.JSONDecodeError, TypeError):
        reactions = {}

    user = frappe.session.user
    users_list = reactions.get(emoji, [])

    if user in users_list:
        users_list.remove(user)
        if not users_list:
            reactions.pop(emoji, None)
    else:
        users_list.append(user)
        reactions[emoji] = users_list

    frappe.db.set_value("Excom Message", message_name, "reactions", json.dumps(reactions))

    thread = frappe.db.get_value("Excom Message", message_name, "thread")
    frappe.publish_realtime("excom:message_reaction", {
        "message": message_name, "thread": thread, "reactions": reactions,
    }, after_commit=True)

    return {"success": True, "reactions": reactions}


@frappe.whitelist()
def get_tags():
    """Return all available Excom Tag records."""
    return frappe.get_all(
        "Excom Tag",
        fields=["name", "tag_name", "color", "description"],
        order_by="tag_name asc",
        limit=100,
    )


@frappe.whitelist()
def add_thread_tag(thread_id: str, tag_name: str):
    """Add a tag to a thread. Creates the Excom Tag if it doesn't exist."""
    if not frappe.db.exists("Excom Thread", thread_id):
        frappe.throw(_("Thread not found"))

    if not frappe.db.exists("Excom Tag", tag_name):
        frappe.get_doc({
            "doctype": "Excom Tag",
            "tag_name": tag_name,
        }).insert(ignore_permissions=True)

    existing = frappe.db.exists(
        "Excom Thread Tag", {"parent": thread_id, "tag": tag_name}
    )
    if existing:
        return {"success": True, "already_exists": True}

    thread = frappe.get_doc("Excom Thread", thread_id)
    thread.append("tags", {
        "tag": tag_name,
        "added_by": frappe.session.user,
        "added_on": now_datetime(),
    })
    thread.save(ignore_permissions=True)
    return {"success": True}


@frappe.whitelist()
def remove_thread_tag(thread_id: str, tag_name: str):
    """Remove a tag from a thread."""
    if not frappe.db.exists("Excom Thread", thread_id):
        frappe.throw(_("Thread not found"))

    thread = frappe.get_doc("Excom Thread", thread_id)
    thread.tags = [t for t in thread.tags if t.tag != tag_name]
    thread.save(ignore_permissions=True)
    return {"success": True}


@frappe.whitelist()
def get_thread_tags(thread_id: str):
    """Return tags for a specific thread."""
    return frappe.db.sql(
        """
        SELECT tt.tag, t.color, t.tag_name
        FROM `tabExcom Thread Tag` tt
        JOIN `tabExcom Tag` t ON t.name = tt.tag
        WHERE tt.parent = %(thread_id)s
        ORDER BY tt.added_on ASC
        """,
        {"thread_id": thread_id},
        as_dict=True,
    )


@frappe.whitelist()
def get_related_documents(omni_identity: str):
    """
    Returns all transaction documents linked to an Omni Identity.

    Customer-side: Quotation, Sales Order, Delivery Note, Sales Invoice.
    Supplier-side: Request for Quotation, Purchase Order, Purchase Receipt, Purchase Invoice.
    """
    result = {
        "quotations": [],
        "sales_orders": [],
        "delivery_notes": [],
        "sales_invoices": [],
        "rfqs": [],
        "purchase_orders": [],
        "purchase_receipts": [],
        "purchase_invoices": [],
    }

    if not omni_identity:
        return result

    links = frappe.get_all(
        "Omni Identity Link",
        filters={"parent": omni_identity},
        fields=["linked_doctype", "linked_name"],
    )

    customer_names = [
        l.linked_name for l in links if l.linked_doctype == "Customer"
    ]
    supplier_names = [
        l.linked_name for l in links if l.linked_doctype == "Supplier"
    ]

    common_fields = ["name", "grand_total", "status", "currency"]
    date_field_map = {
        "Quotation": "transaction_date",
        "Sales Order": "transaction_date",
        "Delivery Note": "posting_date",
        "Sales Invoice": "posting_date",
        "Request for Quotation": "transaction_date",
        "Purchase Order": "transaction_date",
        "Purchase Receipt": "posting_date",
        "Purchase Invoice": "posting_date",
    }

    if customer_names:
        customer_doctypes = {
            "Quotation": ("quotations", "party_name", "customer_name"),
            "Sales Order": ("sales_orders", "customer", "customer_name"),
            "Delivery Note": ("delivery_notes", "customer", "customer_name"),
            "Sales Invoice": ("sales_invoices", "customer", "customer_name"),
        }
        for dt, (key, filter_field, name_field) in customer_doctypes.items():
            date_field = date_field_map[dt]
            fields = common_fields + [date_field, name_field]
            if dt == "Sales Invoice":
                fields.append("outstanding_amount")
            try:
                filters = {filter_field: ["in", customer_names], "docstatus": ["!=", 2]}
                if dt == "Quotation":
                    filters["quotation_to"] = "Customer"
                result[key] = frappe.get_all(
                    dt, filters=filters, fields=fields,
                    order_by=f"{date_field} desc", limit=15,
                )
            except Exception:
                pass

    if supplier_names:
        supplier_doctypes = {
            "Request for Quotation": ("rfqs", None, None),
            "Purchase Order": ("purchase_orders", "supplier", "supplier_name"),
            "Purchase Receipt": ("purchase_receipts", "supplier", "supplier_name"),
            "Purchase Invoice": ("purchase_invoices", "supplier", "supplier_name"),
        }
        for dt, (key, filter_field, name_field) in supplier_doctypes.items():
            date_field = date_field_map[dt]
            if dt == "Request for Quotation":
                try:
                    rfq_names = frappe.get_all(
                        "Request for Quotation Supplier",
                        filters={"supplier": ["in", supplier_names]},
                        pluck="parent",
                    )
                    if rfq_names:
                        result[key] = frappe.get_all(
                            dt,
                            filters={"name": ["in", list(set(rfq_names))], "docstatus": ["!=", 2]},
                            fields=common_fields + [date_field],
                            order_by=f"{date_field} desc",
                            limit=15,
                        )
                except Exception:
                    pass
            else:
                fields = common_fields + [date_field, name_field]
                if dt == "Purchase Invoice":
                    fields.append("outstanding_amount")
                try:
                    result[key] = frappe.get_all(
                        dt,
                        filters={filter_field: ["in", supplier_names], "docstatus": ["!=", 2]},
                        fields=fields,
                        order_by=f"{date_field} desc",
                        limit=15,
                    )
                except Exception:
                    pass

    return result
