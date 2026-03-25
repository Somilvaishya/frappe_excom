import json
import re

import frappe
import frappe.sessions
from frappe import _

no_cache = 1

SCRIPT_TAG_PATTERN = re.compile(r"\<script[^<]*\</script\>")
CLOSING_SCRIPT_TAG_PATTERN = re.compile(r"</script\>")


def get_context(context):
    csrf_token = frappe.sessions.get_csrf_token()
    frappe.db.commit()  # nosemgrep

    if frappe.session.user == "Guest":
        frappe.throw(_("Please login to access Excom"), frappe.AuthenticationError)

    user_roles = frappe.get_roles(frappe.session.user)
    allowed = {"System Manager", "Excom Manager", "Excom User"}
    if not allowed.intersection(user_roles):
        frappe.throw(
            _("You do not have access to Excom. Contact your administrator to get the Excom User or Excom Manager role."),
            frappe.PermissionError,
        )

    try:
        boot = frappe.sessions.get()
    except Exception as e:
        raise frappe.SessionBootFailed from e

    boot_json = frappe.as_json(boot, indent=None, separators=(",", ":"))
    boot_json = SCRIPT_TAG_PATTERN.sub("", boot_json)
    boot_json = CLOSING_SCRIPT_TAG_PATTERN.sub("", boot_json)
    boot_json = json.dumps(boot_json)

    context.update(
        {
            "build_version": frappe.utils.get_build_version(),
            "boot": boot_json,
            "csrf_token": csrf_token,
        }
    )

    app_name = frappe.get_website_settings("app_name") or frappe.get_system_settings("app_name")

    if app_name and app_name != "Frappe":
        context["app_name"] = app_name + " | Excom"
    else:
        context["app_name"] = "Excom"

    context["sitename"] = boot.get("sitename")

    return context


@frappe.whitelist(methods=["POST"], allow_guest=True)
def get_context_for_dev():
    if not frappe.conf.developer_mode:
        frappe.throw(_("This method is only meant for developer mode"))
    return json.loads(get_boot())


def get_boot():
    try:
        boot = frappe.sessions.get()
    except Exception as e:
        raise frappe.SessionBootFailed from e

    boot_json = frappe.as_json(boot, indent=None, separators=(",", ":"))
    boot_json = SCRIPT_TAG_PATTERN.sub("", boot_json)
    boot_json = CLOSING_SCRIPT_TAG_PATTERN.sub("", boot_json)
    boot_json = json.dumps(boot_json)

    return boot_json
