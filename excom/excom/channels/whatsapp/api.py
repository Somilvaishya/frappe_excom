import frappe

from excom.excom.api.flow_endpoint import handle_flow_request as _handle_flow_request
from excom.excom.utils.bulk_messaging import (
	get_progress as _get_progress,
	import_recipients as _import_recipients,
	retry_failed as _retry_failed,
	schedule_bulk_messages as _schedule_bulk_messages,
)
from excom.excom.utils.webhook import webhook as _webhook


@frappe.whitelist(allow_guest=True)
def webhook():
	"""Channel-scoped WhatsApp webhook endpoint."""
	return _webhook()


@frappe.whitelist(allow_guest=True)
def handle_flow_request():
	"""Channel-scoped WhatsApp Flow data exchange endpoint."""
	return _handle_flow_request()


@frappe.whitelist()
def get_progress(name):
	"""Channel-scoped bulk message progress endpoint."""
	return _get_progress(name)


@frappe.whitelist()
def retry_failed(name):
	"""Channel-scoped bulk message retry endpoint."""
	return _retry_failed(name)


@frappe.whitelist()
def import_recipients(
	list_name,
	doctype,
	mobile_field,
	name_field=None,
	filters=None,
	limit=None,
	data_fields=None,
):
	"""Channel-scoped recipient import endpoint."""
	return _import_recipients(
		list_name=list_name,
		doctype=doctype,
		mobile_field=mobile_field,
		name_field=name_field,
		filters=filters,
		limit=limit,
		data_fields=data_fields,
	)


@frappe.whitelist()
def schedule_bulk_messages():
	"""Channel-scoped bulk scheduler endpoint."""
	return _schedule_bulk_messages()
