import hashlib
import re

import frappe
from frappe import _
from frappe.model.document import Document


class OmniIdentity(Document):
	def validate(self):
		self.normalize_identifiers()
		self.compute_fingerprint()
		self.validate_merge_state()

	def normalize_identifiers(self):
		if self.primary_phone:
			self.normalized_phone = normalize_phone(self.primary_phone)
			if not self.primary_whatsapp:
				self.primary_whatsapp = self.normalized_phone
		else:
			self.normalized_phone = ""

		if self.primary_email:
			self.normalized_email = normalize_email(self.primary_email)
		else:
			self.normalized_email = ""

	def compute_fingerprint(self):
		"""Deterministic hash from normalized identifiers for fast dedup lookups."""
		parts = sorted(filter(None, [self.normalized_phone, self.normalized_email]))
		if not parts:
			self.hash_fingerprint = ""
			return
		raw = "|".join(parts)
		self.hash_fingerprint = hashlib.sha256(raw.encode()).hexdigest()[:40]

	def validate_merge_state(self):
		if self.status == "Merged" and not self.merged_into:
			frappe.throw(_("A merged identity must reference the master it was merged into."))
		if self.status == "Merged":
			self.is_master = 0

	def add_channel(self, channel_type: str, channel_user_id: str, verified: bool = False):
		"""Add a channel identifier if it doesn't already exist."""
		for ch in self.channels:
			if ch.channel_type == channel_type and ch.channel_user_id == channel_user_id:
				ch.last_seen = frappe.utils.now_datetime()
				if verified:
					ch.verified = 1
				return ch

		row = self.append("channels", {
			"channel_type": channel_type,
			"channel_user_id": channel_user_id,
			"verified": 1 if verified else 0,
			"last_seen": frappe.utils.now_datetime(),
		})
		return row

	def add_link(self, doctype: str, name: str, role: str = "Unknown"):
		"""Link an ERP entity if not already linked."""
		for ln in self.linked_entities:
			if ln.linked_doctype == doctype and ln.linked_name == name:
				return ln

		row = self.append("linked_entities", {
			"linked_doctype": doctype,
			"linked_name": name,
			"role": role,
		})
		return row

	def merge_into(self, master_identity):
		"""Merge this identity into a master. Moves channels and links, marks self as merged."""
		if self.name == master_identity.name:
			frappe.throw(_("Cannot merge an identity into itself."))

		for ch in self.channels:
			master_identity.add_channel(ch.channel_type, ch.channel_user_id, ch.verified)

		for ln in self.linked_entities:
			master_identity.add_link(ln.linked_doctype, ln.linked_name, ln.role)

		if not master_identity.primary_phone and self.primary_phone:
			master_identity.primary_phone = self.primary_phone
		if not master_identity.primary_email and self.primary_email:
			master_identity.primary_email = self.primary_email
		if not master_identity.primary_whatsapp and self.primary_whatsapp:
			master_identity.primary_whatsapp = self.primary_whatsapp

		group_id = master_identity.merge_group_id or master_identity.name
		master_identity.merge_group_id = group_id
		master_identity.save(ignore_permissions=True)

		self.status = "Merged"
		self.merged_into = master_identity.name
		self.is_master = 0
		self.merge_group_id = group_id
		self.save(ignore_permissions=True)


def normalize_phone(phone: str) -> str:
	"""Strip everything except digits from a phone number."""
	if not phone:
		return ""
	return re.sub(r"[^\d]", "", phone)


def normalize_email(email: str) -> str:
	"""Lowercase and strip whitespace."""
	if not email:
		return ""
	return email.strip().lower()


@frappe.whitelist()
def resolve_identity(phone: str = "", email: str = "", channel: str = "", channel_user_id: str = "", display_name: str = ""):
	"""
	Identity resolution entry point.

	Attempts to find an existing Omni Identity by:
	  1. normalized_phone match
	  2. channel_user_id match in child table
	  3. normalized_email match

	If no match found, creates a new Omni Identity.

	Returns the Omni Identity name.
	"""
	norm_phone = normalize_phone(phone)
	norm_email = normalize_email(email)
	identity_name = None

	if norm_phone:
		identity_name = frappe.db.get_value(
			"Omni Identity",
			{"normalized_phone": norm_phone, "status": ["!=", "Merged"]},
			"name",
		)

	if not identity_name and channel and channel_user_id:
		result = frappe.db.sql(
			"""
			SELECT parent FROM `tabOmni Identity Channel`
			WHERE channel_type = %(channel)s AND channel_user_id = %(uid)s
			LIMIT 1
			""",
			{"channel": channel, "uid": channel_user_id},
			as_dict=True,
		)
		if result:
			parent_status = frappe.db.get_value("Omni Identity", result[0].parent, "status")
			if parent_status != "Merged":
				identity_name = result[0].parent

	if not identity_name and norm_email:
		identity_name = frappe.db.get_value(
			"Omni Identity",
			{"normalized_email": norm_email, "status": ["!=", "Merged"]},
			"name",
		)

	if identity_name:
		identity = frappe.get_doc("Omni Identity", identity_name)
		changed = False

		if channel and channel_user_id:
			identity.add_channel(channel, channel_user_id, verified=True)
			changed = True

		if norm_phone and not identity.primary_phone:
			identity.primary_phone = phone
			changed = True

		if norm_email and not identity.primary_email:
			identity.primary_email = email
			changed = True

		if changed:
			identity.save(ignore_permissions=True)

		return identity.name

	doc = frappe.get_doc({
		"doctype": "Omni Identity",
		"display_name": display_name or phone or email or "Unknown",
		"primary_phone": phone or "",
		"primary_email": email or "",
		"primary_whatsapp": normalize_phone(phone) if phone else "",
		"status": "Active",
		"is_master": 1,
	})

	if channel and channel_user_id:
		doc.append("channels", {
			"channel_type": channel,
			"channel_user_id": channel_user_id,
			"verified": 1,
			"last_seen": frappe.utils.now_datetime(),
		})

	doc.insert(ignore_permissions=True)
	frappe.db.commit()

	return doc.name


@frappe.whitelist()
def merge_identities(source: str, target: str):
	"""Merge source identity into target (master)."""
	source_doc = frappe.get_doc("Omni Identity", source)
	target_doc = frappe.get_doc("Omni Identity", target)

	if source_doc.status == "Merged":
		frappe.throw(_("Source identity is already merged."))

	source_doc.merge_into(target_doc)
	frappe.db.commit()

	return {"merged": source, "into": target}
