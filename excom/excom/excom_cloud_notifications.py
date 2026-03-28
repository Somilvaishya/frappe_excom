"""Token management against the remote Excom Cloud push server.

Mirrors raven/raven_cloud_notifications.py: CRUD operations for
FCM tokens on the remote server via FrappeClient.
"""

from __future__ import annotations

import json
from urllib.parse import urlparse

import frappe
from frappe.frappeclient import FrappeClient


def _get_site_name() -> str:
	"""Return the hostname portion of the site URL."""
	return urlparse(frappe.utils.get_url()).hostname


def _get_client() -> FrappeClient:
	"""Build an authenticated FrappeClient for the Excom Cloud server."""
	settings = frappe.get_single("Excom Settings")
	return FrappeClient(
		url=settings.push_notification_server_url,
		api_key=settings.push_notification_api_key,
		api_secret=settings.get_password("push_notification_api_secret"),
	)


def add_token_to_excom_cloud(user_id: str, token: str) -> None:
	"""Register a single FCM token on the remote Excom Cloud server.

	Args:
		user_id: The Frappe user email.
		token: The FCM device token.
	"""
	try:
		client = _get_client()
		client.post_api(
			"excom_cloud.api.notification.create_user_token",
			params={
				"user_id": user_id,
				"token": token,
				"site_name": _get_site_name(),
			},
		)
	except Exception:
		frappe.log_error(title="Excom Cloud: failed to add token")


def delete_token_from_excom_cloud(user_id: str, token: str) -> None:
	"""Remove a single FCM token from the remote Excom Cloud server.

	Args:
		user_id: The Frappe user email.
		token: The FCM device token.
	"""
	try:
		client = _get_client()
		client.post_api(
			"excom_cloud.api.notification.delete_user_token",
			params={
				"user_id": user_id,
				"token": token,
				"site_name": _get_site_name(),
			},
		)
	except Exception:
		frappe.log_error(title="Excom Cloud: failed to delete token")


def sync_users_tokens_to_excom_cloud() -> None:
	"""Bulk-sync all local Excom Push Token records to Excom Cloud.

	Sends tokens in batches of 10 to avoid payload limits.
	Called via frappe.enqueue from api/notification.py.
	"""
	tokens = frappe.db.get_all(
		"Excom Push Token",
		fields=["user", "fcm_token"],
		order_by="user",
	)

	chunks = [tokens[i : i + 10] for i in range(0, len(tokens), 10)]

	for chunk in chunks:
		try:
			client = _get_client()
			client.post_api(
				"excom_cloud.api.notification.import_user_tokens",
				params={
					"site_name": _get_site_name(),
					"tokens": json.dumps(chunk),
				},
			)
		except Exception:
			frappe.log_error(title="Excom Cloud: failed to sync token batch")
