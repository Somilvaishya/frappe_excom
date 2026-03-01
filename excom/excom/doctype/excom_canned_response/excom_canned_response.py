import frappe
from frappe.model.document import Document


class ExcomCannedResponse(Document):
    """Pre-saved reply template for quick insertion in chat."""

    def validate(self):
        self.shortcode = (self.shortcode or "").strip().lower().replace(" ", "_")
        if self.shortcode.startswith("/"):
            self.shortcode = self.shortcode[1:]
