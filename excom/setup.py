"""
Post-install and post-migrate setup for Excom.

Ensures all required seed data (channels, etc.) exists in the database.
Runs after every install and every migrate so channel records are never missing.
"""

import frappe


CHANNELS = [
	{
		"name": "whatsapp",
		"channel_label": "WhatsApp",
		"allows_multiple_accounts": 1,
		"is_enabled": 1,
		"description": "WhatsApp Business API channel.",
	},
	{
		"name": "email",
		"channel_label": "Email",
		"allows_multiple_accounts": 1,
		"is_enabled": 1,
		"description": "Email channel integrated via Gmail API (OAuth2). Bodies stored in Gmail, only metadata synced.",
	},
]


def after_install():
	"""Called once after bench install-app excom."""
	seed_channels()


def after_migrate():
	"""Called after every bench migrate. Ensures seed data is intact."""
	seed_channels()


def seed_channels():
	"""Create any missing Excom Channel records.

	Temporarily sets frappe.flags.in_migrate so the Excom Channel
	controller allows the programmatic insert (it blocks UI creation).
	"""
	was_in_migrate = frappe.flags.in_migrate
	frappe.flags.in_migrate = True

	try:
		for ch in CHANNELS:
			if frappe.db.exists("Excom Channel", ch["name"]):
				continue

			doc = frappe.get_doc({
				"doctype": "Excom Channel",
				"__newname": ch["name"],
				"channel_label": ch["channel_label"],
				"allows_multiple_accounts": ch["allows_multiple_accounts"],
				"is_enabled": ch["is_enabled"],
				"description": ch["description"],
			})
			doc.insert(ignore_permissions=True)

		frappe.db.commit()
	finally:
		frappe.flags.in_migrate = was_in_migrate
