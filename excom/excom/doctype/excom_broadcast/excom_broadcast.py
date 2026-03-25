"""Excom Broadcast controller — submittable doctype for sending bulk messages."""

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import now_datetime


class ExcomBroadcast(Document):
    def validate(self):
        if self.channel == "WhatsApp" and not self.wa_template:
            frappe.throw(_("WhatsApp Template is required for WhatsApp broadcasts"))
        if self.channel == "Email":
            if not self.email_subject:
                frappe.throw(_("Subject is required for Email broadcasts"))
            if not self.email_body:
                frappe.throw(_("Email Body is required for Email broadcasts"))

    def on_submit(self):
        """Queue the broadcast for sending."""
        active = frappe.db.count(
            "Excom Subscriber",
            {"subscriber_list": self.subscriber_list, "status": "Subscribed"},
        )
        self.db_set("total_recipients", active, update_modified=False)
        self.db_set("status", "Queued", update_modified=False)

        frappe.enqueue(
            "excom.excom.services.broadcast_service.execute_broadcast",
            broadcast_name=self.name,
            queue="long",
            timeout=3600,
            is_async=True,
        )

    def on_cancel(self):
        if self.status == "Sending":
            frappe.throw(_("Cannot cancel a broadcast that is currently sending"))
        self.db_set("status", "Draft", update_modified=False)

    @frappe.whitelist()
    def preview_email(self) -> dict:
        """
        Render the email body with the first subscriber's data for preview.

        Returns:
            {"subject": "...", "body": "...", "subscriber": "..."}
        """
        if self.channel != "Email":
            frappe.throw(_("Preview is only for Email broadcasts"))

        first_sub = frappe.db.get_value(
            "Excom Subscriber",
            {"subscriber_list": self.subscriber_list, "status": "Subscribed"},
            "omni_identity",
        )
        if not first_sub:
            return {"subject": self.email_subject, "body": self.email_body, "subscriber": ""}

        from excom.excom.services.broadcast_service import render_email_body

        rendered = render_email_body(self.email_body, first_sub)
        return {
            "subject": self.email_subject,
            "body": rendered,
            "subscriber": first_sub,
        }
