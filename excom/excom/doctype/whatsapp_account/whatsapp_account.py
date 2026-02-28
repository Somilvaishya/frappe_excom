# Copyright (c) 2025, Shridhar Patil and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class WhatsAppAccount(Document):
	def validate(self):
		self.auto_compute_webhook_url()

	def on_update(self):
		"""Check there is only one default of each type, then sync to Settings."""
		self.there_must_be_only_one_default()
		self.sync_to_settings()

	def auto_compute_webhook_url(self):
		"""Auto-populate the read-only webhook_url field for convenience."""
		site = frappe.utils.get_url()
		self.webhook_url = f"{site}/api/method/excom.excom.utils.webhook.webhook"

	def there_must_be_only_one_default(self):
		"""If current WhatsApp Account is default, un-default all other accounts."""
		for field in ("is_default_incoming", "is_default_outgoing"):
			if not self.get(field):
				continue

			for whatsapp_account in frappe.get_all("WhatsApp Account", filters={field: 1}):
				if whatsapp_account.name == self.name:
					continue

				whatsapp_account = frappe.get_doc("WhatsApp Account", whatsapp_account.name)
				whatsapp_account.set(field, 0)
				whatsapp_account.save()

	def sync_to_settings(self):
		"""Keep WhatsApp Settings single in sync with account-level flags."""
		if not frappe.db.exists("DocType", "WhatsApp Settings"):
			return
		settings = frappe.get_single("WhatsApp Settings")
		changed = False
		if self.is_default_incoming and settings.default_incoming_account != self.name:
			settings.default_incoming_account = self.name
			changed = True
		if self.is_default_outgoing and settings.default_outgoing_account != self.name:
			settings.default_outgoing_account = self.name
			changed = True
		if changed:
			settings.save(ignore_permissions=True)