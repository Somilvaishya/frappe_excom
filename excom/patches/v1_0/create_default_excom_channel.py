import frappe


def execute():
	"""Seed the default WhatsApp channel for Excom."""
	if frappe.db.exists("Excom Channel", "whatsapp"):
		return

	doc = frappe.get_doc(
		{
			"doctype": "Excom Channel",
			"channel_label": "WhatsApp",
			"channel_key": "whatsapp",
			"account_doctype": "WhatsApp Account",
			"allows_multiple_accounts": 1,
			"is_active": 1,
			"description": "System channel mapped to WhatsApp accounts from legacy WhatsApp module.",
		}
	)
	doc.insert(ignore_permissions=True)
