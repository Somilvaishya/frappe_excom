"""
Analytics API — whitelisted endpoints for the Excom analytics dashboard.

Provides access to Meta's WhatsApp analytics APIs plus internal Excom metrics.
"""

from __future__ import annotations

import json

import frappe
from frappe import _

from excom.excom.api.chat import _check_excom_access


@frappe.whitelist()
def get_analytics_overview(account_name: str = "", days: int = 30) -> dict:
    """
    Get a combined analytics overview for the dashboard.

    Args:
        account_name: Excom Channel Account name (if empty, uses first active WA account)
        days: Lookback period in days (default 30)

    Returns:
        Combined messaging, conversation, and pricing overview
    """
    _check_excom_access()

    if not account_name:
        account_name = _get_default_wa_account()

    if not account_name:
        return {"error": "No WhatsApp account configured"}

    from excom.excom.services.whatsapp_analytics import get_account_overview
    return get_account_overview(account_name, int(days))


@frappe.whitelist()
def get_messaging_analytics(
    account_name: str = "",
    start: int = 0,
    end: int = 0,
    granularity: str = "DAY",
) -> dict:
    """
    Fetch messaging analytics (messages sent/delivered per phone number).

    Args:
        account_name: Excom Channel Account name
        start/end: UNIX timestamps
        granularity: DAY | HALF_HOUR | MONTH
    """
    _check_excom_access()

    if not account_name:
        account_name = _get_default_wa_account()
    if not account_name:
        return {"error": "No WhatsApp account configured"}

    from excom.excom.services.whatsapp_analytics import (
        get_messaging_analytics as _get,
    )
    return _get(
        account_name,
        int(start) or None,
        int(end) or None,
        granularity,
    )


@frappe.whitelist()
def get_conversation_analytics(
    account_name: str = "",
    start: int = 0,
    end: int = 0,
    granularity: str = "DAILY",
    dimensions: str = "",
    categories: str = "",
) -> dict:
    """
    Fetch conversation analytics (counts, costs by category).

    Args:
        account_name: Excom Channel Account name
        start/end: UNIX timestamps
        granularity: DAILY | HALF_HOUR | MONTHLY
        dimensions: comma-separated (CONVERSATION_CATEGORY, CONVERSATION_TYPE, COUNTRY, PHONE)
        categories: comma-separated (AUTHENTICATION, MARKETING, SERVICE, UTILITY)
    """
    _check_excom_access()

    if not account_name:
        account_name = _get_default_wa_account()
    if not account_name:
        return {"error": "No WhatsApp account configured"}

    dim_list = [d.strip() for d in dimensions.split(",") if d.strip()] if dimensions else None
    cat_list = [c.strip() for c in categories.split(",") if c.strip()] if categories else None

    from excom.excom.services.whatsapp_analytics import (
        get_conversation_analytics as _get,
    )
    return _get(
        account_name,
        int(start) or None,
        int(end) or None,
        granularity,
        dim_list,
        cat_list,
    )


@frappe.whitelist()
def get_template_analytics(
    account_name: str = "",
    template_ids: str = "",
    start: int = 0,
    end: int = 0,
) -> dict:
    """
    Fetch template performance analytics (sent/delivered/read/clicked).

    Args:
        account_name: Excom Channel Account name
        template_ids: comma-separated list of Meta template IDs
        start/end: UNIX timestamps
    """
    _check_excom_access()

    if not account_name:
        account_name = _get_default_wa_account()
    if not account_name:
        return {"error": "No WhatsApp account configured"}

    if not template_ids:
        return {"data": []}

    ids = [t.strip() for t in template_ids.split(",") if t.strip()]

    from excom.excom.services.whatsapp_analytics import (
        get_template_analytics as _get,
    )
    return _get(account_name, ids, int(start) or None, int(end) or None)


@frappe.whitelist()
def get_pricing_analytics(
    account_name: str = "",
    start: int = 0,
    end: int = 0,
    granularity: str = "DAILY",
    dimensions: str = "",
) -> dict:
    """
    Fetch pricing/cost analytics.

    Args:
        account_name: Excom Channel Account name
        start/end: UNIX timestamps
        granularity: DAILY | HALF_HOUR | MONTHLY
        dimensions: comma-separated (COUNTRY, PHONE, PRICING_CATEGORY, PRICING_TYPE, TIER)
    """
    _check_excom_access()

    if not account_name:
        account_name = _get_default_wa_account()
    if not account_name:
        return {"error": "No WhatsApp account configured"}

    dim_list = [d.strip() for d in dimensions.split(",") if d.strip()] if dimensions else None

    from excom.excom.services.whatsapp_analytics import (
        get_pricing_analytics as _get,
    )
    return _get(
        account_name,
        int(start) or None,
        int(end) or None,
        granularity,
        dim_list,
    )


@frappe.whitelist()
def get_internal_metrics(days: int = 30) -> dict:
    """
    Get internal Excom metrics: message volumes, response times, channel distribution.

    These are computed from Excom's own database, not Meta's API.
    """
    _check_excom_access()

    from frappe.utils import add_days, now_datetime, getdate

    end_date = now_datetime()
    start_date = add_days(end_date, -int(days))

    messages_by_day = frappe.db.sql(
        """
        SELECT DATE(provider_timestamp) AS day,
               direction,
               COUNT(*) AS count
        FROM `tabExcom Message`
        WHERE provider_timestamp >= %(start)s
        GROUP BY DATE(provider_timestamp), direction
        ORDER BY day
        """,
        {"start": start_date},
        as_dict=True,
    )

    messages_by_channel = frappe.db.sql(
        """
        SELECT channel, COUNT(*) AS count
        FROM `tabExcom Message`
        WHERE provider_timestamp >= %(start)s
        GROUP BY channel
        """,
        {"start": start_date},
        as_dict=True,
    )

    messages_by_type = frappe.db.sql(
        """
        SELECT message_type, COUNT(*) AS count
        FROM `tabExcom Message`
        WHERE provider_timestamp >= %(start)s
        GROUP BY message_type
        ORDER BY count DESC
        """,
        {"start": start_date},
        as_dict=True,
    )

    active_threads = frappe.db.count(
        "Excom Thread",
        filters={"last_message_at": [">=", start_date]},
    )

    total_threads = frappe.db.count("Excom Thread")

    new_identities = frappe.db.count(
        "Omni Identity",
        filters={"creation": [">=", start_date]},
    )

    avg_response = frappe.db.sql(
        """
        SELECT AVG(TIMESTAMPDIFF(SECOND, inbound.provider_timestamp, outbound.provider_timestamp)) AS avg_seconds
        FROM `tabExcom Message` outbound
        INNER JOIN (
            SELECT thread, MAX(provider_timestamp) AS provider_timestamp
            FROM `tabExcom Message`
            WHERE direction = 'Inbound'
              AND provider_timestamp >= %(start)s
            GROUP BY thread
        ) inbound ON outbound.thread = inbound.thread
        WHERE outbound.direction = 'Outbound'
          AND outbound.provider_timestamp > inbound.provider_timestamp
          AND outbound.provider_timestamp <= DATE_ADD(inbound.provider_timestamp, INTERVAL 24 HOUR)
        """,
        {"start": start_date},
        as_dict=True,
    )
    avg_response_seconds = round(avg_response[0].avg_seconds or 0) if avg_response else 0

    agent_performance = frappe.db.sql(
        """
        SELECT created_by_user AS agent,
               COUNT(*) AS messages_sent
        FROM `tabExcom Message`
        WHERE direction = 'Outbound'
          AND provider_timestamp >= %(start)s
          AND created_by_user IS NOT NULL
          AND created_by_user != ''
        GROUP BY created_by_user
        ORDER BY messages_sent DESC
        LIMIT 10
        """,
        {"start": start_date},
        as_dict=True,
    )

    return {
        "period_days": int(days),
        "messages_by_day": messages_by_day,
        "messages_by_channel": messages_by_channel,
        "messages_by_type": messages_by_type,
        "active_threads": active_threads,
        "total_threads": total_threads,
        "new_contacts": new_identities,
        "avg_response_time_seconds": avg_response_seconds,
        "agent_performance": agent_performance,
    }


@frappe.whitelist()
def get_wa_accounts() -> list[dict]:
    """Return active WhatsApp channel accounts for the analytics account picker."""
    _check_excom_access()
    return frappe.get_all(
        "Excom Channel Account",
        filters={"channel": "whatsapp", "status": "Active"},
        fields=["name", "account_name", "wa_business_id", "wa_phone_id"],
        order_by="account_name asc",
    )


def _get_default_wa_account() -> str:
    """Return the first active WhatsApp account name, or empty string."""
    accounts = frappe.get_all(
        "Excom Channel Account",
        filters={"channel": "whatsapp", "status": "Active"},
        fields=["name"],
        limit=1,
    )
    return accounts[0]["name"] if accounts else ""
