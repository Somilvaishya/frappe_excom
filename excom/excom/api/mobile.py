"""Mobile app APIs for OAuth client management and site discovery.

Mirrors raven/api/raven_mobile.py: provides get_client_id (guest)
and create_oauth_client (manager) for the Excom mobile app.
"""

import frappe
from frappe.utils.change_log import get_versions


@frappe.whitelist(allow_guest=True)
def get_client_id() -> dict:
	"""Return OAuth client_id, site metadata, and branding for the mobile app.

	This is the first endpoint the mobile app hits after the user
	enters a site URL. It returns everything needed to initiate
	an OAuth2 PKCE flow.
	"""
	app_name = (
		frappe.get_website_settings("app_name")
		or frappe.get_system_settings("app_name")
	)
	if not app_name or app_name == "Frappe":
		app_name = "Excom"

	all_app_versions = get_versions()
	app_versions = {k: v["version"] for k, v in all_app_versions.items()}

	can_manage = False
	if frappe.session.user != "Guest":
		roles = frappe.get_roles(frappe.session.user)
		can_manage = bool(set(roles) & {"System Manager", "Excom Manager"})

	return {
		"client_id": frappe.db.get_single_value("Excom Settings", "oauth_client"),
		"system_timezone": frappe.get_system_settings("time_zone"),
		"app_name": app_name,
		"sitename": frappe.local.site,
		"excom_version": app_versions.get("excom", "0.0.0"),
		"frappe_version": app_versions.get("frappe", "0.0.0"),
		"logo": (
			frappe.db.get_single_value("Navbar Settings", "app_logo")
			or "/assets/excom/excom/excom-logo.svg"
		),
		"can_manage_mobile_oauth": can_manage,
		"site_url": frappe.utils.get_url(),
	}


@frappe.whitelist(methods=["POST"])
def create_oauth_client() -> dict:
	"""Create or update the OAuth Client used by the Excom mobile app.

	Only System Managers / Excom Managers should call this.
	Stores the resulting client reference on Excom Settings.oauth_client.
	"""
	frappe.only_for(["System Manager", "Excom Manager"])

	settings = frappe.get_doc("Excom Settings")
	existing = settings.oauth_client

	if not existing:
		oauth_client = frappe.new_doc("OAuth Client")
	else:
		oauth_client = frappe.get_doc("OAuth Client", existing)

	oauth_client.app_name = "Excom Mobile"
	oauth_client.scopes = "all openid"
	oauth_client.redirect_uris = "excom.app:"
	oauth_client.default_redirect_uri = "excom.app:"
	oauth_client.grant_type = "Authorization Code"
	oauth_client.response_type = "Code"
	oauth_client.allowed_roles = []
	oauth_client.append("allowed_roles", {"role": "Excom User"})
	oauth_client.save(ignore_permissions=True)

	settings.oauth_client = oauth_client.name
	settings.save(ignore_permissions=True)

	return {"message": "OAuth Client created successfully"}
