"""Daily maintenance tasks for Excom push notifications.

Mirrors raven/scheduler/daily.py: fetches invalid FCM tokens
from the Excom Cloud server and deletes the matching local
Excom Push Token records.
"""

from __future__ import annotations

import frappe
from frappe import _
from frappe.frappeclient import FrappeClient

from excom.excom.excom_cloud_notifications import _get_site_name


def sync_invalid_tokens() -> str:
	"""Fetch invalid FCM tokens from Excom Cloud and purge locally.

	Runs as a daily_maintenance scheduler event. Only executes
	when the push service is set to 'Excom Cloud'.

	Returns:
		Status message.
	"""
	push_service = (
		frappe.db.get_single_value("Excom Settings", "push_notification_service")
		or "Frappe Cloud"
	)

	if push_service != "Excom Cloud":
		return "Skipped: not using Excom Cloud"

	settings = frappe.get_single("Excom Settings")

	client = FrappeClient(
		url=settings.push_notification_server_url,
		api_key=settings.push_notification_api_key,
		api_secret=settings.get_password("push_notification_api_secret"),
	)

	batch_size = 10
	site_name = _get_site_name()

	while True:
		try:
			response = client.post_api(
				"excom_cloud.api.notification.sync_invalid_tokens",
				params={
					"site_name": site_name,
					"batch_size": batch_size,
				},
			)

			invalid_tokens = response.get("invalid_tokens", [])
			if not invalid_tokens:
				break

			for token_data in invalid_tokens:
				try:
					frappe.db.delete(
						"Excom Push Token",
						{"fcm_token": token_data.get("invalid_token")},
					)
				except Exception:
					frappe.log_error(
						title=_(f"Excom: failed to delete invalid token {token_data.get('invalid_token')}")
					)

			if not response.get("has_more", False):
				break

		except Exception:
			frappe.log_error(title="Excom: failed to sync invalid tokens")
			break

	return "Invalid tokens synced successfully"
