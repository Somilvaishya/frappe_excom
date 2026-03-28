"""Boot session hook for Excom.

Mirrors raven/boot.py: injects push notification service config
into the Frappe bootinfo so the web client can configure push
appropriately (Frappe Cloud relay vs Excom Cloud w/ Firebase).
"""

import frappe


def boot_session(bootinfo: dict) -> None:
	"""Extend Frappe boot with Excom push configuration."""
	try:
		settings = frappe.get_single("Excom Settings")
	except Exception:
		return

	push_service = settings.push_notification_service or "Frappe Cloud"
	bootinfo.push_notification_service = push_service

	if push_service == "Excom Cloud":
		bootinfo.vapid_public_key = settings.vapid_public_key
		bootinfo.firebase_client_config = settings.push_config
