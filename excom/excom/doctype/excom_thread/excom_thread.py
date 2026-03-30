import frappe
from frappe.model.document import Document

MANAGER_ROLES = {"System Manager", "Excom Manager"}


class ExcomThread(Document):
	def before_insert(self):
		if not self.thread_key:
			self.compute_thread_key()
		self.denormalize_identity()

	def validate(self):
		if not self.thread_key:
			self.compute_thread_key()
		if not self.display_name:
			self.denormalize_identity()

	def has_permission(self, permtype: str = "read", user: str | None = None) -> bool:
		"""Excom User can only access threads assigned to them or their teams."""
		user = user or frappe.session.user
		if user == "Administrator":
			return True

		user_roles = set(frappe.get_roles(user))
		if user_roles & MANAGER_ROLES:
			return True

		if "Excom User" not in user_roles:
			return False

		if self.assigned_to == user:
			return True

		if self.assigned_team:
			from excom.excom.doctype.excom_team.excom_team import get_user_teams
			if self.assigned_team in get_user_teams(user):
				return True

		return False

	def compute_thread_key(self):
		self.thread_key = f"{self.channel}:{self.account}:{self.omni_identity}"

	def denormalize_identity(self):
		if self.omni_identity:
			oi = frappe.db.get_value(
				"Omni Identity",
				self.omni_identity,
				["display_name", "primary_phone"],
				as_dict=True,
			)
			if oi:
				self.display_name = oi.display_name
				self.primary_phone = oi.primary_phone


def has_permission(doc, ptype: str = "read", user: str | None = None) -> bool:
	"""Hook function for frappe's has_permission system."""
	user = user or frappe.session.user
	if user == "Administrator":
		return True

	user_roles = set(frappe.get_roles(user))
	if user_roles & MANAGER_ROLES:
		return True

	if "Excom User" not in user_roles:
		return False

	if isinstance(doc, str):
		doc = frappe.get_doc("Excom Thread", doc)

	if doc.assigned_to == user:
		return True

	if doc.assigned_team:
		from excom.excom.doctype.excom_team.excom_team import get_user_teams
		if doc.assigned_team in get_user_teams(user):
			return True

	return False


def get_permission_query_conditions(user: str | None = None) -> str:
	"""SQL filter for list queries — Excom User sees only own/team threads."""
	user = user or frappe.session.user
	if user == "Administrator":
		return ""

	user_roles = set(frappe.get_roles(user))
	if user_roles & MANAGER_ROLES:
		return ""

	if "Excom User" not in user_roles:
		return "1=0"

	from excom.excom.doctype.excom_team.excom_team import get_user_teams
	teams = get_user_teams(user)

	conditions = [f"`tabExcom Thread`.assigned_to = {frappe.db.escape(user)}"]
	if teams:
		team_list = ", ".join(frappe.db.escape(t) for t in teams)
		conditions.append(f"`tabExcom Thread`.assigned_team IN ({team_list})")

	return f"({' OR '.join(conditions)})"


def on_doctype_update():
	frappe.db.add_index("Excom Thread", ["last_message_at"])
	frappe.db.add_index("Excom Thread", ["omni_identity", "channel", "account"])
