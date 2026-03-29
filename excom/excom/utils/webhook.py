"""Webhook handler for WhatsApp Cloud API."""
import datetime
import json

import frappe
import requests as http_requests
from werkzeug.wrappers import Response

from excom.excom.utils import get_channel_account
from excom.excom.services.thread_service import (
	ingest_inbound_message,
	update_delivery_status,
)


@frappe.whitelist(allow_guest=True)
def webhook():
	"""Meta webhook entry point."""
	if frappe.request.method == "GET":
		return get()
	return post()


def get():
	"""Verify webhook challenge — multiple accounts may share the same token."""
	hub_challenge = frappe.form_dict.get("hub.challenge")
	verify_token = frappe.form_dict.get("hub.verify_token")

	if not verify_token:
		frappe.throw("Missing verify token")

	match = frappe.db.exists(
		"Excom Channel Account",
		{"wa_webhook_verify_token": verify_token},
	)
	if not match:
		frappe.throw("No matching Excom Channel Account")

	return Response(hub_challenge, status=200)


def post():
	"""
	Accept Meta webhook immediately (return 200) and enqueue processing.

	Meta requires a response within 20 seconds or it marks the webhook as
	failed and retries with exponential back-off. We persist the raw payload
	for audit, then hand off all CPU-bound work to a background job.
	"""
	data = frappe.local.form_dict

	# Persist raw payload synchronously so we never lose it even if the job fails.
	try:
		from excom.excom.utils import _notification_log_doctype
		frappe.get_doc({
			"doctype": _notification_log_doctype(),
			"template": "Webhook",
			"meta_data": json.dumps(data),
		}).insert(ignore_permissions=True)
		frappe.db.commit()
	except Exception:
		frappe.log_error("Excom: webhook audit log insert failed")

	# Enqueue actual message/status processing asynchronously.
	frappe.enqueue(
		"excom.excom.utils.webhook._process_webhook_payload",
		data_str=json.dumps(data),
		queue="short",
		# In unit tests frappe.flags.in_test is True, so jobs run inline.
		now=frappe.flags.in_test,
	)

	return Response("", status=200)


def _process_webhook_payload(data_str: str):
	"""
	Background job: parse and process a Meta webhook payload.

	Called from the enqueue in post(). Receives the raw payload as a JSON
	string so it can be safely serialized across the job queue boundary.
	"""
	data = json.loads(data_str)

	messages = []
	phone_id = None
	try:
		messages = data["entry"][0]["changes"][0]["value"].get("messages", [])
		phone_id = (
			data.get("entry", [{}])[0]
			.get("changes", [{}])[0]
			.get("value", {})
			.get("metadata", {})
			.get("phone_number_id")
		)
	except (KeyError, IndexError):
		try:
			messages = data["entry"]["changes"][0]["value"].get("messages", [])
		except (KeyError, IndexError, TypeError):
			pass

	sender_profile_name = next(
		(
			contact.get("profile", {}).get("name")
			for entry in data.get("entry", [])
			for change in entry.get("changes", [])
			for contact in change.get("value", {}).get("contacts", [])
		),
		None,
	)

	channel_account = get_channel_account(phone_id) if phone_id else None
	if not channel_account:
		return

	account_name = channel_account.name

	if messages:
		for message in messages:
			_process_inbound_message(message, sender_profile_name, channel_account, account_name)
	else:
		changes = None
		try:
			changes = data["entry"][0]["changes"][0]
		except (KeyError, IndexError):
			try:
				changes = data["entry"]["changes"][0]
			except (KeyError, IndexError, TypeError):
				pass
		if changes:
			_process_status_update(changes)


def _process_inbound_message(message, sender_profile_name, channel_account, account_name):
	"""Route a single inbound message through the service layer."""
	message_type = message.get("type", "text")
	phone = message.get("from", "")
	provider_msg_id = message.get("id", "")
	provider_ts = ""
	if message.get("timestamp"):
		provider_ts = datetime.datetime.fromtimestamp(int(message["timestamp"])).strftime("%Y-%m-%d %H:%M:%S")

	is_reply = bool(message.get("context") and "forwarded" not in message.get("context", {}))
	reply_to_id = message["context"]["id"] if is_reply else ""

	content_text = ""
	content_json = message
	media_file = ""
	excom_msg_type = "Text"

	type_map = {
		"text": "Text",
		"image": "Image",
		"video": "Video",
		"audio": "Audio",
		"document": "Document",
		"sticker": "Sticker",
		"location": "Location",
		"reaction": "Reaction",
		"button": "Button",
		"interactive": "Interactive",
		"contacts": "Contact",
	}
	excom_msg_type = type_map.get(message_type, "Text")

	if message_type == "text":
		content_text = message.get("text", {}).get("body", "")

	elif message_type == "reaction":
		content_text = message.get("reaction", {}).get("emoji", "")
		reply_to_id = message.get("reaction", {}).get("message_id", "")

	elif message_type == "interactive":
		interactive_data = message.get("interactive", {})
		interactive_type = interactive_data.get("type")

		if interactive_type == "button_reply":
			content_text = interactive_data.get("button_reply", {}).get("title", "")
			excom_msg_type = "Button"
		elif interactive_type == "list_reply":
			content_text = interactive_data.get("list_reply", {}).get("title", "")
			excom_msg_type = "Interactive"
		elif interactive_type == "nfm_reply":
			nfm_reply = interactive_data.get("nfm_reply", {})
			try:
				flow_response = json.loads(nfm_reply.get("response_json", "{}"))
			except json.JSONDecodeError:
				flow_response = {}
			parts = [f"{k}: {v}" for k, v in flow_response.items() if v]
			content_text = ", ".join(parts) if parts else "Flow completed"
			content_json = {"interactive": interactive_data, "flow_response": flow_response}
			excom_msg_type = "Flow"

	elif message_type in ("image", "audio", "video", "document", "sticker"):
		content_text = message.get(message_type, {}).get("caption", "")
		media_file = _download_media(message, message_type, channel_account)

	elif message_type == "button":
		content_text = message.get("button", {}).get("text", "")

	else:
		content_text = str(message.get(message_type, {}).get(message_type, ""))

	ingest_inbound_message(
		phone=phone,
		channel="whatsapp",
		account=account_name,
		provider_message_id=provider_msg_id,
		content_text=content_text,
		message_type=excom_msg_type,
		display_name=sender_profile_name or "",
		content_json=content_json,
		media_file=media_file,
		reply_to_provider_id=reply_to_id,
		provider_timestamp=provider_ts,
	)


def _download_media(message, message_type, channel_account):
	"""Download media from WhatsApp and save as Frappe File. Returns file URL."""
	try:
		token = channel_account.get_password("wa_token")
		base_url = f"{channel_account.wa_url}/{channel_account.wa_version}/"
		media_id = message[message_type]["id"]
		headers = {"Authorization": f"Bearer {token}"}

		response = http_requests.get(f"{base_url}{media_id}/", headers=headers)
		if response.status_code != 200:
			return ""

		media_data = response.json()
		media_url = media_data.get("url")
		mime_type = media_data.get("mime_type", "application/octet-stream")
		file_extension = mime_type.split("/")[-1].split(";")[0]

		media_response = http_requests.get(media_url, headers=headers)
		if media_response.status_code != 200:
			return ""

		file_name = f"{frappe.generate_hash(length=10)}.{file_extension}"
		file_doc = frappe.get_doc({
			"doctype": "File",
			"file_name": file_name,
			"content": media_response.content,
			"is_private": 1,
		}).save(ignore_permissions=True)

		return file_doc.file_url
	except Exception:
		frappe.log_error("Excom: media download failed")
		return ""


def _process_status_update(data):
	"""Handle message status and template status webhook events."""
	if data.get("field") == "message_template_status_update":
		_update_template_status(data["value"])
	elif data.get("field") == "messages":
		_update_message_status(data["value"])


def _update_template_status(data):
	"""Update template status and approval lifecycle timestamps from webhook."""
	event = data.get("event", "")
	template_id = data.get("message_template_id")
	if not template_id:
		return

	now = frappe.utils.now_datetime()
	updates = {"status": event}

	lifecycle_map = {
		"APPROVED": "approved_at",
		"REJECTED": "rejected_at",
		"PAUSED": "paused_at",
		"PENDING": "submitted_at",
	}
	ts_field = lifecycle_map.get(event.upper())
	if ts_field:
		updates[ts_field] = now

	reason = data.get("reason") or data.get("rejection_reason") or ""
	if reason and event.upper() == "REJECTED":
		updates["rejection_reason"] = reason

	name = frappe.db.get_value("WhatsApp Templates", {"id": template_id}, "name")
	if name:
		frappe.db.set_value("WhatsApp Templates", name, updates, update_modified=True)


def _update_message_status(data):
	"""Update delivery status on Excom Message, including error info from Meta."""
	status_entry = data.get("statuses", [{}])[0]
	provider_id = status_entry.get("id")
	status = status_entry.get("status")

	if not (provider_id and status):
		return

	failure_reason = ""
	if status == "failed":
		errors = status_entry.get("errors", [])
		if errors:
			err = errors[0]
			code = err.get("code", "")
			title = err.get("title", "")
			detail = err.get("error_data", {}).get("details", "") or err.get("message", "")
			failure_reason = f"[{code}] {title}: {detail}".strip(": ")

	update_delivery_status(provider_id, status, failure_reason=failure_reason)
