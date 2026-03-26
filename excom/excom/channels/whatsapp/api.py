import frappe

from excom.excom.api.flow_endpoint import handle_flow_request as _handle_flow_request
from excom.excom.utils.webhook import webhook as _webhook


@frappe.whitelist(allow_guest=True)
def webhook():
	"""Channel-scoped WhatsApp webhook endpoint."""
	return _webhook()


@frappe.whitelist(allow_guest=True)
def handle_flow_request():
	"""Channel-scoped WhatsApp Flow data exchange endpoint."""
	return _handle_flow_request()
