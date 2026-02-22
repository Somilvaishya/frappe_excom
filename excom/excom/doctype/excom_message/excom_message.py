import frappe
from frappe.model.document import Document


class ExcomMessage(Document):
	def before_insert(self):
		self.check_idempotency()

	def check_idempotency(self):
		"""Skip duplicate inbound messages based on provider_message_id."""
		if self.provider_message_id and self.direction == "Inbound":
			existing = frappe.db.exists(
				"Excom Message",
				{"provider_message_id": self.provider_message_id},
			)
			if existing:
				frappe.throw(
					f"Duplicate message: {self.provider_message_id}",
					frappe.DuplicateEntryError,
				)


def on_doctype_update():
	frappe.db.add_index("Excom Message", ["provider_message_id"])
	frappe.db.add_index("Excom Message", ["thread", "creation"])
