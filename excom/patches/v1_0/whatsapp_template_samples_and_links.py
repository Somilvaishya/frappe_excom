"""Migrate WhatsApp Templates to JSON body samples and linked accounts child table."""

import json

import frappe


def execute() -> None:
    frappe.reload_doc("excom", "doctype", "whatsapp_template_linked_account")
    frappe.reload_doc("excom", "doctype", "whatsapp_templates")

    for name in frappe.get_all("WhatsApp Templates", pluck="name"):
        bvs = frappe.db.get_value("WhatsApp Templates", name, "body_variable_samples")
        legacy_sv = (frappe.db.get_value("WhatsApp Templates", name, "sample_values") or "").strip()

        empty_bvs = bvs in (None, "", []) or (isinstance(bvs, str) and not bvs.strip())
        if empty_bvs and legacy_sv:
            parsed: list | None = None
            if legacy_sv.startswith("["):
                try:
                    parsed = json.loads(legacy_sv)
                except json.JSONDecodeError:
                    parsed = None
            if parsed is None:
                parsed = [p.strip() for p in legacy_sv.split(",") if p.strip()]
            if isinstance(parsed, list) and parsed:
                frappe.db.set_value(
                    "WhatsApp Templates",
                    name,
                    {
                        "body_variable_samples": json.dumps(parsed),
                        "sample_values": "",
                    },
                    update_modified=False,
                )

        primary = frappe.db.get_value("WhatsApp Templates", name, "whatsapp_account")
        if primary and not frappe.db.exists(
            "WhatsApp Template Linked Account",
            {"parent": name, "channel_account": primary},
        ):
            frappe.get_doc(
                {
                    "doctype": "WhatsApp Template Linked Account",
                    "parent": name,
                    "parenttype": "WhatsApp Templates",
                    "parentfield": "linked_whatsapp_accounts",
                    "channel_account": primary,
                }
            ).insert(ignore_permissions=True)

    frappe.db.commit()
