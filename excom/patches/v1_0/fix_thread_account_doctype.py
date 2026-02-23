"""Fix any Excom Thread records still pointing to WhatsApp Account.

Run after migrate_whatsapp_account_to_channel_account. Updates threads to use
Excom Channel Account when one exists with the same name (both use account_name).
"""

import frappe


def execute():
    if not frappe.db.table_exists("Excom Thread"):
        return

    frappe.db.sql("""
        UPDATE `tabExcom Thread` t
        SET t.account_doctype = 'Excom Channel Account'
        WHERE t.account_doctype = 'WhatsApp Account'
        AND EXISTS (
            SELECT 1 FROM `tabExcom Channel Account` e
            WHERE e.name = t.account
        )
    """)
    frappe.db.commit()
