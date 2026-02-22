"""Migrate WhatsApp Account records into Excom Channel Account."""

import frappe


def execute():
    if not frappe.db.table_exists("WhatsApp Account"):
        return
    if not frappe.db.table_exists("Excom Channel Account"):
        return

    accounts = frappe.get_all(
        "WhatsApp Account",
        fields=[
            "name", "account_name", "status", "url", "version",
            "phone_id", "app_id", "business_id", "webhook_verify_token",
            "is_default_incoming", "is_default_outgoing", "allow_auto_read_receipt",
        ],
    )

    for acct in accounts:
        if frappe.db.exists("Excom Channel Account", acct.account_name):
            continue

        token_val = ""
        try:
            wa_doc = frappe.get_doc("WhatsApp Account", acct.name)
            token_val = wa_doc.get_password("token") or ""
        except Exception:
            pass

        doc = frappe.get_doc({
            "doctype": "Excom Channel Account",
            "account_name": acct.account_name,
            "channel": "whatsapp",
            "status": acct.status or "Active",
            "is_default_incoming": acct.is_default_incoming or 0,
            "is_default_outgoing": acct.is_default_outgoing or 0,
            "wa_token": token_val,
            "wa_url": acct.url or "https://graph.facebook.com",
            "wa_version": acct.version or "v21.0",
            "wa_phone_id": acct.phone_id or "",
            "wa_app_id": acct.app_id or "",
            "wa_business_id": acct.business_id or "",
            "wa_webhook_verify_token": acct.webhook_verify_token or "",
            "wa_allow_auto_read_receipt": acct.allow_auto_read_receipt if acct.allow_auto_read_receipt is not None else 1,
        })
        doc.insert(ignore_permissions=True)

    # Update existing Excom Thread records to point to Excom Channel Account
    if frappe.db.table_exists("Excom Thread"):
        frappe.db.sql("""
            UPDATE `tabExcom Thread`
            SET account_doctype = 'Excom Channel Account'
            WHERE account_doctype = 'WhatsApp Account'
        """)

    # Update existing Excom Message records
    if frappe.db.table_exists("Excom Message"):
        frappe.db.sql("""
            UPDATE `tabExcom Message`
            SET account_doctype = 'Excom Channel Account'
            WHERE account_doctype = 'WhatsApp Account'
        """)

    frappe.db.commit()
