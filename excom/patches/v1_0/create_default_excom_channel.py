import frappe


def execute():
	"""Seed the default WhatsApp channel for Excom."""
	if frappe.db.exists("Excom Channel", "whatsapp"):
		return

	doc = frappe.get_doc(
		{
			"doctype": "Excom Channel",
			"__newname": "whatsapp",
			"channel_label": "WhatsApp",
			"allows_multiple_accounts": 1,
			"is_enabled": 1,
			"description": "WhatsApp Business API channel.",
		}
	)
	doc.insert(ignore_permissions=True)
