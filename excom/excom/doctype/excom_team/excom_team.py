"""Excom Team controller."""

import frappe
from frappe import _
from frappe.model.document import Document

GENERAL_TEAM = "General"


class ExcomTeam(Document):
    def validate(self):
        self._check_duplicate_members()
        if self.get("__islocal"):
            return
        if self.name == GENERAL_TEAM and self.has_value_changed("team_name"):
            frappe.throw(_("The General team cannot be renamed"))

    def before_rename(self, old_name, new_name, merge=False):
        if old_name == GENERAL_TEAM:
            frappe.throw(_("The General team cannot be renamed"))

    def on_trash(self):
        if self.name == GENERAL_TEAM:
            frappe.throw(_("The General team cannot be deleted"))

    def _check_duplicate_members(self):
        """Prevent the same user from appearing twice in one team."""
        seen = set()
        for m in self.get("members", []):
            if m.user in seen:
                frappe.throw(_("User {0} is already in this team").format(m.user))
            seen.add(m.user)


def get_user_teams(user: str = "") -> list[str]:
    """Return team names where the given user is a member."""
    if not user:
        user = frappe.session.user

    if user == "Administrator":
        return frappe.get_all("Excom Team", pluck="name")

    return frappe.get_all(
        "Excom Team Member",
        filters={"parenttype": "Excom Team", "user": user},
        pluck="parent",
    )
