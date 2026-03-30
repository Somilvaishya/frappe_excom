"""Excom Email Signature DocType controller."""

import frappe
from frappe import _
from frappe.model.document import Document


class ExcomEmailSignature(Document):
    """Per-user email signature configuration."""

    def validate(self) -> None:
        """Ensure only one signature per user."""
        if self.user != frappe.session.user:
            frappe.has_permission("Excom Email Signature", "write", throw=True)
