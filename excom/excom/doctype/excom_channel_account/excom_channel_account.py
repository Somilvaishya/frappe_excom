import frappe
from frappe.model.document import Document


class ExcomChannelAccount(Document):
	def on_update(self):
		self.ensure_single_default()

	def ensure_single_default(self):
		"""Only one default incoming and one default outgoing per channel."""
		for field in ("is_default_incoming", "is_default_outgoing"):
			if not self.get(field):
				continue
			others = frappe.get_all(
				"Excom Channel Account",
				filters={"channel": self.channel, field: 1, "name": ["!=", self.name]},
			)
			for other in others:
				frappe.db.set_value("Excom Channel Account", other.name, field, 0)

	@property
	def token(self):
		"""Alias for backward compat — returns wa_token password."""
		return self.get_password("wa_token")

	@property
	def url(self):
		return self.wa_url

	@property
	def version(self):
		return self.wa_version

	@property
	def phone_id(self):
		return self.wa_phone_id

	@property
	def business_id(self):
		return self.wa_business_id

	@property
	def app_id(self):
		return self.wa_app_id

	@property
	def webhook_verify_token(self):
		return self.wa_webhook_verify_token

	@property
	def allow_auto_read_receipt(self):
		return self.wa_allow_auto_read_receipt
