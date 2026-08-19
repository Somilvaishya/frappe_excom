"""Tests for per-account Gmail token storage/refresh in gmail_service.

Network is mocked; these exercise the real store/refresh/capture code paths so
that multiple mailboxes stay isolated on their own encrypted fields.
"""

from unittest.mock import MagicMock, patch

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import add_to_date, now_datetime
from frappe.utils.password import get_decrypted_password

from excom.excom.services import gmail_service

DOCTYPE = "Excom Channel Account"


class TestGmailTokenStore(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		# Requires the seeded "email" Excom Channel.
		cls.skip = not frappe.db.exists("Excom Channel", "email")
		if cls.skip:
			return

		cls.app = frappe.get_doc(
			{
				"doctype": "Connected App",
				"provider_name": "excom-test-gmail",
				"token_uri": "https://oauth2.googleapis.com/token",
				"client_id": "test-client-id",
			}
		)
		cls.app.client_secret = "test-secret"
		cls.app.insert(ignore_permissions=True)

	@classmethod
	def tearDownClass(cls):
		if not getattr(cls, "skip", True):
			frappe.delete_doc("Connected App", cls.app.name, force=True, ignore_permissions=True)
		super().tearDownClass()

	def setUp(self):
		if self.skip:
			self.skipTest("email Excom Channel not seeded on this site")
		self.acc = frappe.get_doc(
			{
				"doctype": DOCTYPE,
				"account_name": frappe.generate_hash("excom-gmail-test", 10),
				"channel": "email",
				"status": "Active",
				"email_address": "primary@example.com",
				"email_connected_app": self.app.name,
				"email_connected_user": "Administrator",
			}
		).insert(ignore_permissions=True)
		self.name = self.acc.name

	def tearDown(self):
		if not self.skip:
			frappe.delete_doc(DOCTYPE, self.name, force=True, ignore_permissions=True)

	# -- read path --------------------------------------------------------
	def test_returns_stored_token_when_fresh(self):
		gmail_service._store_account_tokens(self.name, "AT-fresh", "RT-1", 3600)
		with patch.object(gmail_service, "requests") as req:
			token = gmail_service.get_access_token(self.name)
			req.post.assert_not_called()  # no refresh when fresh
		self.assertEqual(token, "AT-fresh")

	def test_refreshes_when_expired(self):
		gmail_service._store_account_tokens(self.name, "AT-old", "RT-1", 3600)
		# Force expiry into the past.
		frappe.db.set_value(
			DOCTYPE, self.name, "email_token_expiry", add_to_date(now_datetime(), seconds=-10)
		)
		resp = MagicMock(status_code=200)
		resp.json.return_value = {"access_token": "AT-new", "expires_in": 3600}
		with patch.object(gmail_service, "requests") as req:
			req.post.return_value = resp
			token = gmail_service.get_access_token(self.name)
			req.post.assert_called_once()
		self.assertEqual(token, "AT-new")
		self.assertEqual(
			get_decrypted_password(DOCTYPE, self.name, "email_access_token"), "AT-new"
		)

	def test_invalid_grant_deauthorizes(self):
		gmail_service._store_account_tokens(self.name, "AT", "RT-dead", 3600)
		frappe.db.set_value(
			DOCTYPE, self.name, "email_token_expiry", add_to_date(now_datetime(), seconds=-10)
		)
		resp = MagicMock(status_code=400)
		resp.json.return_value = {"error": "invalid_grant"}
		resp.text = '{"error": "invalid_grant"}'
		with patch.object(gmail_service, "requests") as req:
			req.post.return_value = resp
			with self.assertRaises(frappe.ValidationError):
				gmail_service.get_access_token(self.name)
		self.assertEqual(frappe.db.get_value(DOCTYPE, self.name, "email_authorized"), 0)
		self.assertFalse(
			get_decrypted_password(DOCTYPE, self.name, "email_refresh_token", raise_exception=False)
		)

	# -- capture path -----------------------------------------------------
	def _make_shared_cache(self):
		tc = frappe.get_doc(
			{"doctype": "Token Cache", "connected_app": self.app.name, "user": "Administrator"}
		)
		tc.access_token = "SHARED-AT"
		tc.refresh_token = "SHARED-RT"
		tc.expires_in = 3600
		tc.insert(ignore_permissions=True)
		self.addCleanup(
			lambda: frappe.delete_doc("Token Cache", tc.name, force=True, ignore_permissions=True)
		)

	def test_capture_stores_on_mailbox_match(self):
		self._make_shared_cache()
		with patch.object(
			gmail_service, "_profile_with_token", return_value={"emailAddress": "primary@example.com"}
		):
			result = gmail_service.capture_tokens_from_connected_app(self.name)
		self.assertTrue(result["authorized"])
		self.assertEqual(
			get_decrypted_password(DOCTYPE, self.name, "email_refresh_token"), "SHARED-RT"
		)

	def test_capture_rejects_wrong_mailbox(self):
		self._make_shared_cache()
		with patch.object(
			gmail_service, "_profile_with_token", return_value={"emailAddress": "someone-else@example.com"}
		):
			result = gmail_service.capture_tokens_from_connected_app(self.name)
		self.assertFalse(result["authorized"])
		self.assertIn("wrong mailbox", (result["error"] or "").lower())
		self.assertFalse(
			get_decrypted_password(DOCTYPE, self.name, "email_refresh_token", raise_exception=False)
		)
