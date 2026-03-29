import frappe
from frappe.model.document import Document


class ExcomThread(Document):
	def before_insert(self):
		if not self.thread_key:
			self.compute_thread_key()
		self.denormalize_identity()

	def validate(self):
		if not self.thread_key:
			self.compute_thread_key()
		if not self.display_name:
			self.denormalize_identity()

	def compute_thread_key(self):
		self.thread_key = f"{self.channel}:{self.account}:{self.omni_identity}"

	def denormalize_identity(self):
		if self.omni_identity:
			oi = frappe.db.get_value(
				"Omni Identity",
				self.omni_identity,
				["display_name", "primary_phone"],
				as_dict=True,
			)
			if oi:
				self.display_name = oi.display_name
				self.primary_phone = oi.primary_phone


def on_doctype_update():
	frappe.db.add_index("Excom Thread", ["last_message_at"])
	frappe.db.add_index("Excom Thread", ["omni_identity", "channel", "account"])
