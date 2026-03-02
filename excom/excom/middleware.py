"""
Request hooks for the Excom app.

Adds CORS headers to webchat API responses so the embeddable chat
widget works when loaded from any origin.

The widget sends simple requests (form-encoded, no custom headers,
credentials: "omit") to avoid CORS preflight entirely.  Guest sessions
have no saved CSRF token, so Frappe's CSRF check passes automatically.
"""

import frappe

WEBCHAT_PATH_PREFIX = "/api/method/excom.excom.api.webchat."


def add_webchat_cors_headers(response, **kwargs):
	"""
	after_request hook.

	Attaches Access-Control-Allow-Origin to all webchat API responses
	so the browser lets cross-origin JS read them.
	"""
	if not frappe.request or not frappe.request.path.startswith(WEBCHAT_PATH_PREFIX):
		return

	origin = frappe.request.headers.get("Origin", "*")
	response.headers["Access-Control-Allow-Origin"] = origin
	response.headers["Access-Control-Allow-Methods"] = "POST"
	response.headers["Access-Control-Max-Age"] = "86400"
