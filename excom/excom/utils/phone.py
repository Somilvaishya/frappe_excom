"""
Shared phone number validation and normalization for Excom.

All DocTypes that store phone numbers should call validate_phone_number()
in their validate() hook to ensure consistent E.164 formatting.
"""

import re

import frappe
from frappe import _


_E164_PATTERN = re.compile(r"^\+?[1-9]\d{6,14}$")


def normalize_phone(number: str) -> str:
    """
    Strip non-digit characters (except leading +) and return a clean number.
    Does NOT add a country code — the input must already have one.

    Args:
        number: Raw phone string, e.g. "+91 98765-43210"

    Returns:
        Cleaned string like "919876543210"
    """
    if not number:
        return ""
    has_plus = number.strip().startswith("+")
    digits = re.sub(r"[^\d]", "", number)
    if has_plus:
        return f"+{digits}"
    return digits


def validate_phone_number(number: str, field_label: str = "Phone") -> str:
    """
    Validate and normalize a phone number to E.164-compatible format.

    Enforces:
    - 7-15 digit length (ITU-T E.164 spec)
    - Must start with a non-zero country code digit
    - Strips all non-numeric chars (except leading +)

    Args:
        number: Raw phone string
        field_label: Human-readable field name for error messages

    Returns:
        Normalized phone string (with leading + if present)

    Raises:
        frappe.ValidationError if the number is invalid
    """
    if not number:
        return ""

    cleaned = normalize_phone(number)
    check = cleaned.lstrip("+")

    if not check:
        frappe.throw(
            _("{0} is empty after cleaning: {1}").format(field_label, number),
            frappe.ValidationError,
        )

    if len(check) < 7 or len(check) > 15:
        frappe.throw(
            _("{0} must be 7-15 digits (got {1} digits): {2}").format(
                field_label, len(check), number
            ),
            frappe.ValidationError,
        )

    if not _E164_PATTERN.match(cleaned):
        frappe.throw(
            _("{0} is not a valid phone number: {1}").format(field_label, number),
            frappe.ValidationError,
        )

    return cleaned
