"""Excom Push Token controller.

Mirrors Raven Push Token: on insert/trash, routes the FCM token
to either Frappe Cloud's push relay or the Excom Cloud server.
"""

import frappe
from frappe.model.document import Document

from excom.excom.notification import EXCOM_RELAY_PROJECT_NAME


class ExcomPushToken(Document):
	"""Stores an FCM token for a user (web or mobile)."""

	def after_insert(self) -> None:
		push_service = self._get_push_service()

		if push_service == "Frappe Cloud" and _relay_subscribe_allowed():
			try:
				from frappe.push_notification import subscribe

				subscribe(self.fcm_token, EXCOM_RELAY_PROJECT_NAME)
			except ImportError:
				pass
			except Exception:
				frappe.log_error(title="Excom: failed to subscribe token via Frappe Cloud")
		elif push_service == "Excom Cloud":
			from excom.excom.excom_cloud_notifications import add_token_to_excom_cloud

			add_token_to_excom_cloud(self.user, self.fcm_token)

	def on_trash(self) -> None:
		push_service = self._get_push_service()

		if push_service == "Frappe Cloud" and _relay_subscribe_allowed():
			try:
				from frappe.push_notification import unsubscribe

				unsubscribe(self.fcm_token, EXCOM_RELAY_PROJECT_NAME)
			except ImportError:
				pass
			except Exception:
				frappe.log_error(title="Excom: failed to unsubscribe token via Frappe Cloud")
		elif push_service == "Excom Cloud":
			from excom.excom.excom_cloud_notifications import delete_token_from_excom_cloud

			delete_token_from_excom_cloud(self.user, self.fcm_token)

	def _get_push_service(self) -> str:
		return (
			frappe.db.get_single_value("Excom Settings", "push_notification_service")
			or "Frappe Cloud"
		)


def _relay_subscribe_allowed() -> bool:
	"""Same gate as Settings UI: relay on + push_relay_server_url (mirrors practical Raven + FC setup)."""
	from excom.excom.api.notification import are_push_notifications_enabled

	return bool(are_push_notifications_enabled())
