"""Helpers for WhatsApp Templates body variables and account eligibility.

Body samples are stored as a JSON array (``body_variable_samples``) so values
can contain commas. Legacy ``sample_values`` used comma-splitting and is only
used when the JSON field is empty.
"""

from __future__ import annotations

import json
import re
from typing import Any

import frappe


def ordered_placeholder_numbers(text: str) -> list[int]:
    """Unique ``{{n}}`` placeholder numbers in order of first appearance in *text*."""
    order: list[int] = []
    for m in re.finditer(r"\{\{(\d+)\}\}", text or ""):
        n = int(m.group(1))
        if n not in order:
            order.append(n)
    return order


def get_body_variable_samples(template: Any) -> list[str]:
    """Return ordered example strings for each ``{{n}}`` body placeholder.

    Accepts a ``WhatsApp Templates`` document, a mapping from ``get_value``, or
    a document name string.
    """
    if isinstance(template, str):
        row = frappe.db.get_value(
            "WhatsApp Templates",
            template,
            ["body_variable_samples", "sample_values"],
            as_dict=True,
        )
        if not row:
            return []
        template = row

    raw = template.get("body_variable_samples") if isinstance(template, dict) else getattr(
        template, "body_variable_samples", None
    )

    if raw not in (None, "", []):
        data = raw
        if isinstance(raw, str) and raw.strip():
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                data = None
        if isinstance(data, list):
            return ["" if x is None else str(x) for x in data]

    legacy = (
        (template.get("sample_values") if isinstance(template, dict) else getattr(template, "sample_values", None))
        or ""
    )
    legacy = legacy.strip() if isinstance(legacy, str) else ""
    if not legacy:
        return []

    if legacy.startswith("["):
        try:
            data = json.loads(legacy)
            if isinstance(data, list):
                return ["" if x is None else str(x) for x in data]
        except json.JSONDecodeError:
            pass

    return [p.strip() for p in legacy.split(",") if p.strip()]


def template_is_linked_to_account(template_name: str, channel_account: str) -> bool:
    """True if the template may be sent from this Excom Channel Account."""
    if not template_name or not channel_account:
        return False
    primary = frappe.db.get_value("WhatsApp Templates", template_name, "whatsapp_account")
    if primary == channel_account:
        return True
    return bool(
        frappe.db.exists(
            "WhatsApp Template Linked Account",
            {"parent": template_name, "channel_account": channel_account},
        )
    )
