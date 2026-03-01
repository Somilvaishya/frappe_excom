# Copyright (c) 2026, Sagar Ratan Garg and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class ExcomChannel(Document):
	"""System-managed channel master used by Excom orchestration."""

	def before_insert(self):
		"""Block manual channel creation from Desk/API outside migration contexts."""
		if not _is_system_write_context():
			frappe.throw(
				_("Excom Channel records are system-managed and cannot be created from the UI."),
				frappe.PermissionError,
			)

	def validate(self):
		"""Block manual edits to channel metadata outside migration contexts."""
		if not self.is_new() and not _is_system_write_context():
			frappe.throw(
				_("Excom Channel records are system-managed and cannot be edited from the UI."),
				frappe.PermissionError,
			)

	def on_trash(self):
		"""Block deletion outside migration contexts."""
		if not _is_system_write_context():
			frappe.throw(
				_("Excom Channel records are system-managed and cannot be deleted from the UI."),
				frappe.PermissionError,
			)


def _is_system_write_context() -> bool:
	"""Return True when writes are triggered by install/migrate/patch execution."""
	return any(
		(
			frappe.flags.in_install,
			frappe.flags.in_migrate,
			frappe.flags.in_patch,
			frappe.flags.in_setup_wizard,
			getattr(frappe.flags, "in_install_app", False),
		)
	)
