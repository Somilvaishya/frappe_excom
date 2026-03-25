"""Remap whatsapp_account Link fields from WhatsApp Account to Excom Channel Account.

After changing JSON options from WhatsApp Account to Excom Channel Account,
existing records may reference names that exist in both doctypes (names are the same).
This patch verifies each reference is valid in Excom Channel Account and nullifies
any that cannot be mapped.
"""

import frappe


DOCTYPES_WITH_WA_LINK = [
    "WhatsApp Templates",
    "WhatsApp Message",
    "WhatsApp Flow",
    "Bulk WhatsApp Message",
    "WhatsApp Profiles",
]


def execute():
    if not frappe.db.table_exists("Excom Channel Account"):
        return

    valid_names = set(
        r.name for r in frappe.get_all("Excom Channel Account", fields=["name"])
    )

    for dt in DOCTYPES_WITH_WA_LINK:
        if not frappe.db.table_exists(f"tab{dt}"):
            continue

        records = frappe.db.sql(
            f"SELECT name, whatsapp_account FROM `tab{dt}` WHERE whatsapp_account IS NOT NULL AND whatsapp_account != ''",
            as_dict=True,
        )
        for rec in records:
            if rec.whatsapp_account not in valid_names:
                frappe.db.set_value(dt, rec.name, "whatsapp_account", None, update_modified=False)

    frappe.db.commit()
