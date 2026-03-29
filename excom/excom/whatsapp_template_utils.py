"""Helpers for WhatsApp Templates variable slots and account eligibility.

Body samples are stored as a JSON array (``body_variable_samples``) so values
can contain commas. Legacy ``sample_values`` used comma-splitting and is only
used when the JSON field is empty.

TEXT header variables use ``header_variable_samples`` (JSON array), mirrored
from Meta ``example.header_text`` on fetch, so slot counts stay correct when
placeholders in ``header`` are missing or unsynced.

Meta supports both **positional** (``{{1}}``) and **named** (``{{sale_date}}``)
placeholder syntax. All helpers handle both.
"""

from __future__ import annotations

import json
import re
from typing import Any

import frappe

_PLACEHOLDER_RE = re.compile(r"\{\{([^}]+)\}\}")


def ordered_placeholder_names(text: str) -> list[str]:
    """Unique ``{{...}}`` placeholder names in order of first appearance.

    Handles both positional (``{{1}}``) and named (``{{sale_date}}``) params.
    """
    order: list[str] = []
    for m in _PLACEHOLDER_RE.finditer(text or ""):
        name = m.group(1).strip()
        if name not in order:
            order.append(name)
    return order


def ordered_placeholder_numbers(text: str) -> list[int]:
    """Unique ``{{n}}`` positional placeholder numbers in first-appearance order.

    Kept for backward compatibility. For counting *all* placeholders
    (named + positional) use ``ordered_placeholder_names``.
    """
    order: list[int] = []
    for m in re.finditer(r"\{\{(\d+)\}\}", text or ""):
        n = int(m.group(1))
        if n not in order:
            order.append(n)
    return order


def placeholder_count(text: str) -> int:
    """Count unique ``{{...}}`` placeholders (named or positional) in *text*."""
    return len(ordered_placeholder_names(text))


def is_text_header(header_type: str | None) -> bool:
    """True if *header_type* is a Meta TEXT header (case-insensitive)."""
    return (header_type or "").strip().upper() == "TEXT"


def get_header_variable_samples(template: Any) -> list[str]:
    """Return example strings for TEXT header placeholders from JSON when set.

    Accepts a ``WhatsApp Templates`` document, a mapping from ``get_all`` /
    ``get_value``, or a document name string.
    """
    if isinstance(template, str):
        row = frappe.db.get_value(
            "WhatsApp Templates",
            template,
            "header_variable_samples",
            as_dict=True,
        )
        if not row:
            return []
        template = row

    raw = (
        template.get("header_variable_samples")
        if isinstance(template, dict)
        else getattr(template, "header_variable_samples", None)
    )

    if raw in (None, "", []):
        return []
    data = raw
    if isinstance(raw, str) and raw.strip():
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return []
    if not isinstance(data, list):
        return []
    return ["" if x is None else str(x) for x in data]


def _get_field(template: Any, field: str) -> Any:
    """Get a field from a document, dict, or None."""
    if isinstance(template, dict):
        return template.get(field)
    return getattr(template, field, None)


def header_variable_slot_count(template: Any) -> int:
    """How many TEXT header parameters Meta expects for this template row.

    Checks placeholders in ``header`` text (named or positional), then falls
    back to ``header_variable_samples`` length (from Meta fetch).
    Meta TEXT headers support at most 1 parameter.
    """
    if isinstance(template, str):
        row = frappe.db.get_value(
            "WhatsApp Templates",
            template,
            ["header_type", "header", "header_variable_samples"],
            as_dict=True,
        )
        if not row:
            return 0
        template = row

    htype = _get_field(template, "header_type")
    if not is_text_header(htype):
        return 0

    hdr_text = _get_field(template, "header") or ""
    n = placeholder_count(str(hdr_text))
    if n:
        return n
    return len(get_header_variable_samples(template))


def body_variable_slot_count(template: Any) -> int:
    """How many body parameters Meta expects for this template row.

    Checks placeholders in ``template`` (body) text, then falls back to
    ``body_variable_samples`` length.
    """
    if isinstance(template, str):
        row = frappe.db.get_value(
            "WhatsApp Templates",
            template,
            ["template", "body_variable_samples", "sample_values"],
            as_dict=True,
        )
        if not row:
            return 0
        template = row

    body_text = _get_field(template, "template") or ""
    n = placeholder_count(str(body_text))
    if n:
        return n
    return len(get_body_variable_samples(template))


def get_body_variable_samples(template: Any) -> list[str]:
    """Return ordered example strings for each body placeholder.

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

    raw = _get_field(template, "body_variable_samples")

    if raw not in (None, "", []):
        data = raw
        if isinstance(raw, str) and raw.strip():
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                data = None
        if isinstance(data, list):
            return ["" if x is None else str(x) for x in data]

    legacy = _get_field(template, "sample_values") or ""
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
