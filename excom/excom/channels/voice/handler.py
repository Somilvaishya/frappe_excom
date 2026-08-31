import json
import frappe
from frappe.utils import now_datetime
from .routing import resolve_voice_account, resolve_ring_destination, build_exotel_routing_response
from .providers.exotel import ExotelAdapter

def handle_inbound_routing(params: dict):
	"""
	Inbound Dynamic URL endpoint (<5s execution budget).
	1. Resolves account & caller identity.
	2. Resolves destination ring list (Sticky-then-team).
	3. Emits realtime incoming call event for desk screen pop.
	4. Returns JSON destination payload immediately.
	5. Enqueues background persistence of call record.
	"""
	caller = params.get("CallFrom") or params.get("From") or ""
	business_num = params.get("CallTo") or params.get("To") or ""
	call_sid = params.get("CallSid") or params.get("Sid") or ""
	digits = params.get("digits") or ""

	account = resolve_voice_account(business_num)
	ring_numbers = resolve_ring_destination(caller, business_num, account) if account else []
	response_payload = build_exotel_routing_response(ring_numbers, business_num, account)

	# Publish realtime screen pop before DB writes
	frappe.publish_realtime(
		"excom_incoming_call",
		{
			"provider_call_id": call_sid,
			"from_number": caller,
			"business_number": business_num,
			"account": account.name if account else None,
			"ring_numbers": ring_numbers
		}
	)

	# Enqueue asynchronous creation of Excom Call record
	frappe.enqueue(
		"excom.excom.channels.voice.handler.persist_inbound_call_async",
		call_sid=call_sid,
		caller=caller,
		business_num=business_num,
		account_name=account.name if account else None,
		digits=digits,
		raw_params=params,
		queue="short"
	)

	return response_payload

def persist_inbound_call_async(call_sid, caller, business_num, account_name, digits, raw_params):
	"""Asynchronous persistence of inbound call record."""
	if not call_sid or frappe.db.exists("Excom Call", {"provider_call_id": call_sid}):
		return

	clean_caller = (caller or "").strip().lstrip("+")
	identity = frappe.db.get_value(
		"Omni Identity",
		{"primary_phone": ["like", f"%{clean_caller[-10:]}%"]},
		"name"
	)

	call_doc = frappe.new_doc("Excom Call")
	call_doc.provider_call_id = call_sid
	call_doc.direction = "Inbound"
	call_doc.status = "Ringing"
	call_doc.from_number = caller
	call_doc.to_number = business_num
	call_doc.business_number = business_num
	call_doc.channel_account = account_name
	call_doc.omni_identity = identity
	call_doc.ivr_selection = digits
	call_doc.raw_event_payload = json.dumps(raw_params)
	call_doc.insert(ignore_permissions=True)
	frappe.db.commit()

def handle_status_webhook(params: dict, account_name: str = None):
	"""Status callback webhook processor."""
	call_sid = params.get("CallSid") or params.get("Sid")
	if not call_sid:
		return {"status": "ignored", "reason": "No CallSid"}

	call_id = frappe.db.get_value("Excom Call", {"provider_call_id": call_sid}, "name")
	if not call_id:
		return {"status": "ignored", "reason": "Call not found"}

	status_raw = (params.get("DialCallStatus") or params.get("Status") or "completed").lower()
	status_map = {
		"completed": "Completed",
		"busy": "Busy",
		"no-answer": "Missed",
		"failed": "Failed",
		"canceled": "Canceled"
	}
	new_status = status_map.get(status_raw, "Completed")
	duration = int(params.get("DialCallDuration") or params.get("Duration") or 0)
	rec_url = params.get("RecordingUrl")

	update_fields = {"status": new_status}
	if duration:
		update_fields["duration"] = duration
		update_fields["talk_time"] = duration
	if rec_url:
		update_fields["recording_url"] = rec_url

	frappe.db.set_value("Excom Call", call_id, update_fields)
	frappe.db.commit()

	# Emit realtime status update
	frappe.publish_realtime(
		"excom_call_status_update",
		{
			"call_id": call_id,
			"provider_call_id": call_sid,
			"status": new_status,
			"duration": duration
		}
	)

	return {"status": "updated", "call_id": call_id}