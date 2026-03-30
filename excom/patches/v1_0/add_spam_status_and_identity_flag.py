import frappe


def execute():
    """Reload Excom Thread (Spam status) and Omni Identity (is_spam flag)."""
    frappe.reload_doc("excom", "doctype", "excom_thread")
    frappe.reload_doc("excom", "doctype", "omni_identity")
