"""
Broadcast Metrics Service.

Captures engagement events and computes analytics for broadcast campaigns.
"""

from __future__ import annotations

from typing import Optional

import frappe
from frappe.utils import now_datetime, time_diff_in_seconds


def record_broadcast_event(
    broadcast_name: str,
    omni_identity: str,
    event_type: str,
    broadcast_message: str = "",
    inbound_message: str = "",
    button_text: str = "",
    sent_at: Optional[str] = None,
) -> None:
    """Record a broadcast engagement event and update aggregate counters."""
    now = now_datetime()
    response_seconds = 0

    if sent_at and event_type in ("Reply", "Button Click", "Read"):
        try:
            response_seconds = int(time_diff_in_seconds(now, sent_at))
        except Exception:
            response_seconds = 0

    frappe.get_doc({
        "doctype": "Excom Broadcast Event",
        "broadcast": broadcast_name,
        "omni_identity": omni_identity,
        "event_type": event_type,
        "event_at": now,
        "response_time_seconds": response_seconds,
        "button_text": button_text[:140] if button_text else "",
        "message": inbound_message or None,
        "broadcast_message": broadcast_message or None,
    }).insert(ignore_permissions=True)

    _update_broadcast_log(broadcast_name, omni_identity, event_type, now, response_seconds)
    _increment_broadcast_counter(broadcast_name, event_type)


def _update_broadcast_log(broadcast_name, omni_identity, event_type, event_at, response_seconds):
    """Update timestamp fields on the per-recipient Broadcast Log."""
    log_name = frappe.db.get_value(
        "Excom Broadcast Log",
        {"broadcast": broadcast_name, "omni_identity": omni_identity},
        "name",
    )
    if not log_name:
        return

    field_map = {
        "Delivered": "delivered_at",
        "Read": "read_at",
        "Reply": "first_reply_at",
        "Button Click": "first_reply_at",
    }
    field = field_map.get(event_type)
    if not field:
        return

    existing = frappe.db.get_value("Excom Broadcast Log", log_name, field)
    if existing:
        return

    updates = {field: event_at}
    if event_type in ("Reply", "Button Click"):
        updates["response_time_seconds"] = response_seconds

    frappe.db.set_value("Excom Broadcast Log", log_name, updates, update_modified=False)


_COUNTER_MAP = {
    "Delivered": "delivered_count",
    "Read": "read_count",
    "Reply": "replied_count",
    "Button Click": "clicked_count",
    "Opt-out": "optout_count",
}


def _increment_broadcast_counter(broadcast_name, event_type):
    """Atomically increment the aggregate counter on Excom Broadcast."""
    field = _COUNTER_MAP.get(event_type)
    if not field:
        return
    frappe.db.sql(
        "UPDATE `tabExcom Broadcast` SET `{0}` = `{0}` + 1 WHERE name = %(name)s".format(field),
        {"name": broadcast_name},
    )


def attribute_delivery_status(provider_message_id, status):
    """Check if message belongs to a broadcast and record delivery/read event."""
    msg = frappe.db.get_value(
        "Excom Message",
        {"provider_message_id": provider_message_id},
        ["name", "reference_doctype", "reference_name", "omni_identity", "provider_timestamp"],
        as_dict=True,
    )
    if not msg or msg.reference_doctype != "Excom Broadcast":
        return

    status_lower = status.lower() if status else ""
    event_map = {"delivered": "Delivered", "read": "Read"}
    event_type = event_map.get(status_lower)
    if not event_type:
        return

    already = frappe.db.exists(
        "Excom Broadcast Event",
        {"broadcast": msg.reference_name, "omni_identity": msg.omni_identity, "event_type": event_type},
    )
    if already:
        return

    record_broadcast_event(
        broadcast_name=msg.reference_name,
        omni_identity=msg.omni_identity,
        event_type=event_type,
        broadcast_message=msg.name,
        sent_at=str(msg.provider_timestamp) if msg.provider_timestamp else "",
    )


def attribute_inbound_reply(inbound_message_name, reply_to_provider_id, message_type, content_text):
    """When an inbound message replies to a broadcast outbound, record event."""
    if not reply_to_provider_id:
        return

    outbound = frappe.db.get_value(
        "Excom Message",
        {"provider_message_id": reply_to_provider_id},
        ["name", "reference_doctype", "reference_name", "omni_identity", "provider_timestamp"],
        as_dict=True,
    )
    if not outbound or outbound.reference_doctype != "Excom Broadcast":
        return

    if message_type in ("Button", "Interactive"):
        event_type = "Button Click"
        button_text = content_text[:140] if content_text else ""
    else:
        event_type = "Reply"
        button_text = ""

    record_broadcast_event(
        broadcast_name=outbound.reference_name,
        omni_identity=outbound.omni_identity,
        event_type=event_type,
        broadcast_message=outbound.name,
        inbound_message=inbound_message_name,
        button_text=button_text,
        sent_at=str(outbound.provider_timestamp) if outbound.provider_timestamp else "",
    )


@frappe.whitelist()
def get_broadcast_metrics(broadcast_name: str, time_windows: str = "") -> dict:
    """Compute comprehensive metrics for a broadcast.

    Delivery funnel is computed from actual Excom Message delivery_status
    data so metrics are accurate even for broadcasts sent before event
    tracking was deployed.  Engagement data comes from Excom Broadcast Event.
    """
    from excom.excom.api.chat import _check_excom_access
    _check_excom_access()

    broadcast = frappe.get_doc("Excom Broadcast", broadcast_name)

    if not time_windows:
        try:
            time_windows = frappe.db.get_single_value(
                "Excom Settings", "broadcast_time_windows",
            ) or "1,3,6,12"
        except Exception:
            time_windows = "1,3,6,12"

    windows = sorted(
        int(h.strip()) for h in time_windows.split(",") if h.strip().isdigit()
    )
    if not windows:
        windows = [1, 3, 6, 12]

    total = broadcast.total_recipients or 0
    sent = broadcast.sent_count or 0
    failed = broadcast.failed_count or 0

    funnel_from_msgs = _compute_delivery_funnel_from_messages(broadcast_name)
    delivered = funnel_from_msgs.get("delivered", 0) or (getattr(broadcast, "delivered_count", 0) or 0)
    read = funnel_from_msgs.get("read", 0) or (getattr(broadcast, "read_count", 0) or 0)
    replied = getattr(broadcast, "replied_count", 0) or 0
    clicked = getattr(broadcast, "clicked_count", 0) or 0
    optout_val = getattr(broadcast, "optout_count", 0) or 0

    delivery_funnel = {
        "total_recipients": total,
        "sent": sent,
        "delivered": delivered,
        "read": read,
        "sent_rate": _pct(sent, total),
        "delivered_rate": _pct(delivered, sent),
        "read_rate": _pct(read, delivered),
        "failed": failed,
        "failed_rate": _pct(failed, total),
    }

    response_by_window = _safe_compute(lambda: _compute_response_windows(broadcast_name, windows, sent), [])
    button_clicks = _safe_compute(lambda: _compute_button_clicks(broadcast_name, sent), [])
    reply_quality = _safe_compute(
        lambda: _compute_reply_quality(broadcast_name, sent),
        {"text_replies": 0, "button_only": 0, "no_response": sent,
         "text_reply_rate": 0, "button_only_rate": 0, "no_response_rate": _pct(sent, sent)},
    )
    optout_data = {"count": optout_val, "rate": _pct(optout_val, sent)}

    overall_engagement = replied + clicked
    avg_resp = _safe_compute(lambda: _compute_avg_response_time(broadcast_name), 0)
    summary = {
        "engagement_rate": _pct(overall_engagement, sent),
        "avg_response_time_seconds": avg_resp,
        "best_performing_cta": (
            button_clicks[0]["button_text"] if button_clicks else None
        ),
    }

    return {
        "broadcast_name": broadcast.broadcast_name,
        "channel": broadcast.channel,
        "status": broadcast.status,
        "time_windows": windows,
        "delivery_funnel": delivery_funnel,
        "response_by_window": response_by_window,
        "button_clicks": button_clicks,
        "reply_quality": reply_quality,
        "optout": optout_data,
        "summary": summary,
    }


def _safe_compute(fn, default):
    """Execute fn, returning default on any error (e.g. missing table)."""
    try:
        return fn()
    except Exception:
        frappe.log_error(title="Excom: broadcast metrics compute error")
        return default


def _compute_delivery_funnel_from_messages(broadcast_name: str) -> dict:
    """Compute delivered/read counts from actual Excom Message delivery_status."""
    try:
        rows = frappe.db.sql(
            """
            SELECT delivery_status, COUNT(*) AS cnt
            FROM `tabExcom Message`
            WHERE reference_doctype = 'Excom Broadcast'
              AND reference_name = %(bc)s
              AND direction = 'Outbound'
            GROUP BY delivery_status
            """,
            {"bc": broadcast_name},
            as_dict=True,
        )
    except Exception:
        return {}

    counts: dict = {}
    for row in rows:
        status = (row.delivery_status or "").lower()
        if status in ("delivered", "read"):
            counts.setdefault("delivered", 0)
            counts["delivered"] += row.cnt
        if status == "read":
            counts.setdefault("read", 0)
            counts["read"] += row.cnt
    return counts


def _compute_response_windows(broadcast_name, windows, sent):
    """Count unique responders within each time window."""
    results = []
    for hours in windows:
        seconds = hours * 3600
        row = frappe.db.sql(
            """SELECT COUNT(DISTINCT omni_identity) AS cnt
            FROM `tabExcom Broadcast Event`
            WHERE broadcast = %(bc)s
              AND event_type IN ('Reply', 'Button Click')
              AND response_time_seconds <= %(secs)s""",
            {"bc": broadcast_name, "secs": seconds},
        )
        count = (row[0][0] if row else 0) or 0
        results.append({
            "window_hours": hours,
            "window_label": "Within {}h".format(hours),
            "count": count,
            "rate": _pct(count, sent),
        })
    return results


def _compute_button_clicks(broadcast_name, sent):
    """Per-button click breakdown, sorted by count descending."""
    rows = frappe.db.sql(
        """SELECT button_text, COUNT(*) AS click_count
        FROM `tabExcom Broadcast Event`
        WHERE broadcast = %(bc)s
          AND event_type = 'Button Click'
          AND IFNULL(button_text, '') != ''
        GROUP BY button_text
        ORDER BY click_count DESC""",
        {"bc": broadcast_name},
        as_dict=True,
    )
    for row in rows:
        row["rate"] = _pct(row["click_count"], sent)
    return rows


def _compute_reply_quality(broadcast_name, sent):
    """Engagement depth: text replies vs button-only vs no response."""
    text_ids = set(frappe.get_all(
        "Excom Broadcast Event",
        filters={"broadcast": broadcast_name, "event_type": "Reply"},
        pluck="omni_identity",
    ))
    btn_ids = set(frappe.get_all(
        "Excom Broadcast Event",
        filters={"broadcast": broadcast_name, "event_type": "Button Click"},
        pluck="omni_identity",
    ))
    text_count = len(text_ids)
    button_only = len(btn_ids - text_ids)
    total_engaged = len(text_ids | btn_ids)
    no_response = max(sent - total_engaged, 0)
    return {
        "text_replies": text_count,
        "button_only": button_only,
        "no_response": no_response,
        "text_reply_rate": _pct(text_count, sent),
        "button_only_rate": _pct(button_only, sent),
        "no_response_rate": _pct(no_response, sent),
    }


def _compute_avg_response_time(broadcast_name):
    """Average response time in seconds across reply/click events."""
    result = frappe.db.sql(
        """SELECT AVG(response_time_seconds) AS avg_time
        FROM `tabExcom Broadcast Event`
        WHERE broadcast = %(bc)s
          AND event_type IN ('Reply', 'Button Click')
          AND response_time_seconds > 0""",
        {"bc": broadcast_name},
        as_dict=True,
    )
    return round(result[0].avg_time or 0, 0) if result else 0


def _pct(numerator, denominator):
    """Safe percentage calculation."""
    if not denominator:
        return 0.0
    return round((numerator / denominator) * 100, 1)
