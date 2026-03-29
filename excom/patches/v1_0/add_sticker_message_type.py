import frappe


def execute():
    """Reload Excom Message to pick up new Sticker message type option."""
    frappe.reload_doc("excom", "doctype", "excom_message")
    frappe.reload_doc("excom", "doctype", "excom_sticker")
