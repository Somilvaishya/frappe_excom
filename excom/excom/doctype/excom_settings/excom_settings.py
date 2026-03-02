import frappe
from frappe.model.document import Document


class ExcomSettings(Document):
	def validate(self):
		if self.auto_cleanup_enabled and (not self.cleanup_retention_days or self.cleanup_retention_days < 1):
			self.cleanup_retention_days = 1
