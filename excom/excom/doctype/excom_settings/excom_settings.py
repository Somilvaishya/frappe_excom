import frappe
from frappe.model.document import Document


class ExcomSettings(Document):
	def validate(self):
		if self.auto_cleanup_enabled and (not self.cleanup_retention_days or self.cleanup_retention_days < 1):
			self.cleanup_retention_days = 1


@frappe.whitelist()
def get_branding() -> dict:
	"""Return branding settings for the React frontend."""
	settings = frappe.get_single("Excom Settings")
	result = {
		"logo_gradient_from": settings.logo_gradient_from or "#3b82f6",
		"logo_gradient_to": settings.logo_gradient_to or "#9333ea",
		"show_app_name": bool(settings.show_app_name),
		"app_name": "",
	}

	if result["show_app_name"]:
		result["app_name"] = frappe.db.get_single_value(
			"Website Settings", "app_name"
		) or ""

	return result
