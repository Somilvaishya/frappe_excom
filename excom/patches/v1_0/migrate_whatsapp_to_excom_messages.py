"""Migrate WhatsApp Message + Profiles data into Omni Identity + Excom Thread + Excom Message."""

import re

import frappe
from frappe.utils import now_datetime


def execute():
	if not frappe.db.table_exists("WhatsApp Message"):
		return

	if not frappe.db.table_exists("Excom Thread"):
		return

	if not frappe.db.exists("Excom Channel", "whatsapp"):
		return

	profiles = frappe.get_all(
		"WhatsApp Profiles",
		fields=["name", "profile_name", "number", "whatsapp_account"],
	)

	for profile in profiles:
		number = _normalize(profile.number)
		if not number:
			continue

		identity_name = frappe.db.get_value(
			"Omni Identity",
			{"normalized_phone": number, "status": ["!=", "Merged"]},
			"name",
		)

		if not identity_name:
			identity = frappe.get_doc({
				"doctype": "Omni Identity",
				"display_name": profile.profile_name or number,
				"primary_phone": number,
				"primary_whatsapp": number,
				"status": "Active",
				"is_master": 1,
			})
			identity.append("channels", {
				"channel_type": "whatsapp",
				"channel_user_id": number,
				"verified": 1,
				"last_seen": now_datetime(),
			})
			identity.insert(ignore_permissions=True)
			identity_name = identity.name

		account = profile.whatsapp_account
		if not account:
			account = frappe.db.get_value(
				"WhatsApp Account",
				{"is_default_outgoing": 1},
				"name",
			)
		if not account:
			account = frappe.db.get_value("WhatsApp Account", {}, "name")
		if not account:
			continue

		thread_key = f"whatsapp:{account}:{identity_name}"
		thread_name = frappe.db.get_value("Excom Thread", {"thread_key": thread_key}, "name")

		if not thread_name:
			oi = frappe.db.get_value(
				"Omni Identity", identity_name,
				["display_name", "primary_phone"], as_dict=True,
			)
			thread = frappe.get_doc({
				"doctype": "Excom Thread",
				"omni_identity": identity_name,
				"channel": "whatsapp",
				"account_doctype": "WhatsApp Account",
				"account": account,
				"thread_key": thread_key,
				"status": "Open",
				"display_name": oi.display_name if oi else number,
				"primary_phone": oi.primary_phone if oi else number,
				"unread_count": 0,
			})
			thread.insert(ignore_permissions=True)
			thread_name = thread.name

		wa_messages = frappe.db.sql(
			"""
			SELECT name, type, status, `to`, `from`, message, message_id,
			       content_type, message_type, creation, is_reply,
			       reply_to_message_id, attach, owner
			FROM `tabWhatsApp Message`
			WHERE (`to` = %(number)s OR `from` = %(number)s)
			ORDER BY creation ASC
			""",
			{"number": number},
			as_dict=True,
		)

		type_map = {
			"text": "Text", "image": "Image", "video": "Video",
			"audio": "Audio", "document": "Document", "location": "Location",
			"reaction": "Reaction", "button": "Button", "interactive": "Interactive",
			"flow": "Flow", "contact": "Contact",
		}
		status_map = {
			"sent": "Sent", "delivered": "Delivered", "read": "Read",
			"failed": "Failed", "Success": "Sent", "marked as read": "Read",
		}

		last_msg_at = None
		last_in = None
		last_out = None
		unread = 0
		last_preview = ""
		last_dir = ""

		for wm in wa_messages:
			if frappe.db.exists("Excom Message", {"provider_message_id": wm.message_id}):
				continue

			direction = "Inbound" if wm.type == "Incoming" else "Outbound"
			msg_type = type_map.get(wm.content_type, "Text")
			delivery = status_map.get(wm.status, "Sent" if direction == "Outbound" else "Delivered")
			content = re.sub(r"<[^>]+>", "", wm.message or "")

			msg = frappe.get_doc({
				"doctype": "Excom Message",
				"thread": thread_name,
				"omni_identity": identity_name,
				"channel": "whatsapp",
				"account_doctype": "WhatsApp Account",
				"account": account,
				"direction": direction,
				"message_type": msg_type,
				"provider_message_id": wm.message_id or "",
				"provider_timestamp": wm.creation,
				"content_text": content,
				"media_file": wm.attach or "",
				"delivery_status": delivery,
				"created_by_user": wm.owner if direction == "Outbound" else None,
			})
			msg.flags.ignore_validate = True
			msg.insert(ignore_permissions=True)

			last_msg_at = wm.creation
			last_preview = content[:120] if content else ""
			last_dir = direction
			if direction == "Inbound":
				last_in = wm.creation
				if delivery not in ("Read",):
					unread += 1
			else:
				last_out = wm.creation

		if last_msg_at:
			frappe.db.sql(
				"""
				UPDATE `tabExcom Thread`
				SET last_message_at = %(at)s,
				    last_inbound_at = %(lin)s,
				    last_outbound_at = %(lout)s,
				    unread_count = %(unread)s,
				    last_message_preview = %(preview)s,
				    last_message_direction = %(dir)s,
				    modified = %(at)s
				WHERE name = %(name)s
				""",
				{
					"at": last_msg_at,
					"lin": last_in,
					"lout": last_out,
					"unread": unread,
					"preview": last_preview,
					"dir": last_dir,
					"name": thread_name,
				},
			)

	frappe.db.commit()


def _normalize(phone):
	if not phone:
		return ""
	return re.sub(r"[^\d]", "", phone)
