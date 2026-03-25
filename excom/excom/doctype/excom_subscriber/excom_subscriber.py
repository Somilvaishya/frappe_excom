"""Excom Subscriber controller."""

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import now_datetime


class ExcomSubscriber(Document):
    def validate(self):
        self._check_duplicate()
        self._set_timestamps()

    def _check_duplicate(self):
        """Prevent the same identity from appearing twice in one list."""
        if self.is_new():
            exists = frappe.db.exists(
                "Excom Subscriber",
                {
                    "subscriber_list": self.subscriber_list,
                    "omni_identity": self.omni_identity,
                },
            )
            if exists:
                frappe.throw(
                    _("{0} is already in list {1}").format(
                        self.omni_identity, self.subscriber_list
                    )
                )

    def _set_timestamps(self):
        if not self.subscribed_on:
            self.subscribed_on = now_datetime()
        if self.status == "Unsubscribed" and not self.unsubscribed_on:
            self.unsubscribed_on = now_datetime()

    def after_insert(self):
        self._update_list_counts()

    def on_trash(self):
        self._update_list_counts()

    def on_update(self):
        self._update_list_counts()

    def _update_list_counts(self):
        """Refresh subscriber counts on the parent list."""
        if not self.subscriber_list:
            return

        total = frappe.db.count(
            "Excom Subscriber", {"subscriber_list": self.subscriber_list}
        )
        active = frappe.db.count(
            "Excom Subscriber",
            {"subscriber_list": self.subscriber_list, "status": "Subscribed"},
        )
        frappe.db.set_value(
            "Excom Subscriber List",
            self.subscriber_list,
            {"total_subscribers": total, "active_subscribers": active},
            update_modified=False,
        )
