"""Excom Subscriber Rule controller."""

import frappe
from frappe import _
from frappe.model.document import Document


class ExcomSubscriberRule(Document):
    def validate(self):
        if self.condition:
            self._validate_condition_syntax()

    def _validate_condition_syntax(self):
        """Verify that the condition compiles without errors."""
        try:
            compile(self.condition.strip(), "<rule>", "eval")
        except SyntaxError as e:
            frappe.throw(_("Invalid condition syntax: {0}").format(str(e)))
