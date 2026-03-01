import frappe


def execute():
	"""Seed the Email channel for Excom."""
	if frappe.db.exists("Excom Channel", "email"):
		return

	doc = frappe.get_doc(
		{
			"doctype": "Excom Channel",
			"__newname": "email",
			"channel_label": "Email",
			"allows_multiple_accounts": 1,
			"is_enabled": 1,
			"description": "Email channel integrated via Gmail API (OAuth2). Bodies stored in Gmail, only metadata synced.",
		}
	)
	doc.insert(ignore_permissions=True)
