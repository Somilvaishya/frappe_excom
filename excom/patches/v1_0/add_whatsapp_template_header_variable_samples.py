"""Reload WhatsApp Templates DocType — adds ``header_variable_samples`` JSON field."""

import frappe


def execute() -> None:
    frappe.reload_doc("excom", "doctype", "whatsapp_templates")
