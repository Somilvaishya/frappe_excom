import frappe


def execute() -> None:
    """Create the Excom Email Signature DocType table."""
    frappe.reload_doc("excom", "doctype", "excom_email_signature")
