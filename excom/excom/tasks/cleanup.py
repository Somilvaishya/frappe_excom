"""
Auto-cleanup of stale inbound-only Omni Identities.

Deletes Omni Identities (and their threads + messages) that were created
by email sync but never received a reply from any Frappe user.  On the
next sync cycle Gmail will recreate them if the source emails still exist.

Protected rule: if even ONE outbound Excom Message exists for an Omni
Identity (on any channel), the identity is kept.
"""

import frappe
from frappe.utils import add_days, now_datetime


def cleanup_stale_identities():
	"""
	Daily scheduler job.  Reads Excom Settings and deletes Omni Identities
	that have only inbound messages and are older than the retention window.
	"""
	settings = frappe.get_single("Excom Settings")
	if not settings.auto_cleanup_enabled:
		return

	retention_days = max(int(settings.cleanup_retention_days or 30), 1)
	channels_csv = (settings.cleanup_channels or "email").strip()
	cleanup_channels = [c.strip() for c in channels_csv.split(",") if c.strip()]

	if not cleanup_channels:
		return

	cutoff = add_days(now_datetime(), -retention_days)

	channel_placeholders = ", ".join(["%s"] * len(cleanup_channels))
	stale_identities = frappe.db.sql(
		f"""
		SELECT DISTINCT oi.name
		FROM `tabOmni Identity` oi
		INNER JOIN `tabOmni Identity Channel` oic
			ON oic.parent = oi.name AND oic.parenttype = 'Omni Identity'
		WHERE oic.channel_type IN ({channel_placeholders})
			AND oi.creation < %s
			AND oi.status = 'Active'
			AND NOT EXISTS (
				SELECT 1 FROM `tabExcom Message` em
				WHERE em.omni_identity = oi.name
					AND em.direction = 'Outbound'
					AND em.created_by_user IS NOT NULL
					AND em.created_by_user != ''
			)
		""",
		tuple(cleanup_channels) + (cutoff,),
		as_dict=True,
	)

	if not stale_identities:
		return

	deleted_count = 0

	for row in stale_identities:
		identity_name = row.name
		try:
			_delete_identity_cascade(identity_name)
			deleted_count += 1
		except Exception:
			frappe.log_error(
				title=f"Excom cleanup failed: {identity_name}",
			)

	if deleted_count:
		frappe.db.commit()
		frappe.logger("excom.cleanup").info(
			f"Auto-cleanup: deleted {deleted_count} stale Omni Identities"
		)


def _delete_identity_cascade(identity_name: str):
	"""
	Delete an Omni Identity and all its dependent Excom Threads and Messages.

	Order: messages first, then threads, then the identity itself —
	avoids foreign-key constraint violations.
	"""
	threads = frappe.get_all(
		"Excom Thread",
		filters={"omni_identity": identity_name},
		pluck="name",
	)

	if threads:
		thread_placeholders = ", ".join(["%s"] * len(threads))
		frappe.db.sql(
			f"DELETE FROM `tabExcom Message` WHERE thread IN ({thread_placeholders})",
			tuple(threads),
		)
		frappe.db.sql(
			f"DELETE FROM `tabExcom Thread` WHERE name IN ({thread_placeholders})",
			tuple(threads),
		)

	frappe.delete_doc(
		"Omni Identity", identity_name,
		ignore_permissions=True,
		force=True,
		delete_permanently=True,
	)
