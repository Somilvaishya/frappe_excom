"""Push notification APIs for token management.

Mirrors raven/api/notification.py: subscribe/unsubscribe FCM tokens,
check if push is enabled, and manage Excom Cloud registration.
"""

from __future__ import annotations

from urllib.parse import urlparse

import frappe
from frappe import _
from frappe.frappeclient import FrappeClient


@frappe.whitelist()
def are_push_notifications_enabled() -> bool:
	"""Check whether push notifications are active for this site.

	- Frappe Cloud: delegates to Push Notification Settings relay flag.
	- Excom Cloud: always True (credentials validated at Settings save).
	"""
	try:
		push_service = (
			frappe.db.get_single_value("Excom Settings", "push_notification_service")
			or "Frappe Cloud"
		)

		if push_service == "Frappe Cloud":
			return bool(
				frappe.db.get_single_value(
					"Push Notification Settings", "enable_push_notification_relay"
				)
			)
		return True
	except frappe.DoesNotExistError:
		return False


@frappe.whitelist(methods=["POST"])
def subscribe(
	fcm_token: str,
	environment: str,
	device_information: str | None = None,
) -> str:
	"""Register a device FCM token for the current user.

	Args:
		fcm_token: Firebase Cloud Messaging device token.
		environment: 'Web' or 'Mobile'.
		device_information: Optional device name/model string.

	Returns:
		'Subscribed' on success.
	"""
	if frappe.db.exists(
		"Excom Push Token",
		{"fcm_token": fcm_token, "user": frappe.session.user},
	):
		return "Already subscribed"

	frappe.get_doc({
		"doctype": "Excom Push Token",
		"fcm_token": fcm_token,
		"user": frappe.session.user,
		"environment": environment,
		"device_information": device_information,
	}).insert(ignore_permissions=True)

	return "Subscribed"


@frappe.whitelist(methods=["POST"])
def unsubscribe(fcm_token: str) -> str:
	"""Remove an FCM token for the current user (e.g. on logout).

	Args:
		fcm_token: The token to remove.

	Returns:
		'Unsubscribed' on success.
	"""
	frappe.db.delete(
		"Excom Push Token",
		{"fcm_token": fcm_token, "user": frappe.session.user},
	)
	return "Unsubscribed"


@frappe.whitelist(methods=["POST"])
def register_site_on_excom_cloud() -> None:
	"""Register this site with the Excom Cloud push server.

	Stores the returned config and VAPID public key on Excom Settings.
	Only available to System Managers.
	"""
	frappe.only_for("System Manager")
	settings = frappe.get_single("Excom Settings")

	if settings.push_notification_service != "Excom Cloud":
		frappe.throw(_("Push notification service is not set to Excom Cloud."))

	client = FrappeClient(
		url=settings.push_notification_server_url,
		api_key=settings.push_notification_api_key,
		api_secret=settings.get_password("push_notification_api_secret"),
	)

	response = client.post_api(
		"excom_cloud.api.notification.register_site",
		params={"site_name": urlparse(frappe.utils.get_url()).hostname},
	)

	settings.push_config = response.get("config")
	settings.vapid_public_key = response.get("vapid_public_key")
	settings.save(ignore_permissions=True)


@frappe.whitelist(methods=["POST"])
def sync_user_tokens_to_excom_cloud() -> str:
	"""Enqueue a bulk sync of all local push tokens to Excom Cloud.

	Only Excom Managers or System Managers may trigger this.
	"""
	frappe.only_for(["System Manager", "Excom Manager"])
	frappe.enqueue(
		"excom.excom.excom_cloud_notifications.sync_users_tokens_to_excom_cloud",
		queue="long",
	)
	return "Token sync enqueued"
