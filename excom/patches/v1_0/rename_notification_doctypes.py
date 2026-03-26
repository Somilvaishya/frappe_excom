"""Rename WhatsApp Notification doctypes to Excom Notification equivalents.

frappe.rename_doc("DocType", ...) handles:
- Table rename (tabWhatsApp Notification -> tabExcom Notification)
- Link field updates across all doctypes
- Property Setter updates
"""
import frappe


def execute():
    renames = [
        ("WhatsApp Message Fields", "Excom Notification Fields"),
        ("WhatsApp Notification Log", "Excom Notification Log"),
        ("WhatsApp Notification", "Excom Notification"),
    ]

    for old_name, new_name in renames:
        if frappe.db.exists("DocType", old_name) and not frappe.db.exists("DocType", new_name):
            frappe.rename_doc("DocType", old_name, new_name, force=True)
            frappe.db.commit()

    if frappe.db.table_exists("tabExcom Notification"):
        frappe.cache().delete_value("whatsapp_notification_map")
        frappe.cache().delete_value("excom_notification_map")
