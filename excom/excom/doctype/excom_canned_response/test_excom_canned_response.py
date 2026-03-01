import frappe
from frappe.tests.utils import FrappeTestCase


class TestExcomCannedResponse(FrappeTestCase):
    def test_shortcode_normalisation(self):
        doc = frappe.get_doc({
            "doctype": "Excom Canned Response",
            "title": "Test Greeting",
            "shortcode": "/Hello World",
            "content": "Hi there!",
        })
        doc.validate()
        self.assertEqual(doc.shortcode, "hello_world")
