"""
Move Gmail OAuth tokens out of Frappe's shared Connected App Token Cache and
into each Excom Channel Account's own encrypted fields.

Frappe's Token Cache is keyed only by (connected_app, user), so multiple Gmail
mailboxes authorized by the same operator through one Connected App collapse
onto a single record -- authorizing one clobbers the others. This patch gives
every account its own copy.

Attribution rules (network-free -- we never call Gmail here):
- Exactly one email account per (connected_app, user): unambiguous, copy the
  shared cache's tokens into it.
- Multiple accounts share a (connected_app, user): we cannot tell offline which
  token belongs to which mailbox, so flag them unauthorized. The operator clicks
  Authorize once per account; capture_tokens_from_connected_app then stores each
  correctly (with mailbox verification).

Idempotent: accounts that already hold their own refresh token are skipped.
"""

import frappe
from frappe.utils import add_to_date, now_datetime
from frappe.utils.password import get_decrypted_password, set_encrypted_password

DOCTYPE = "Excom Channel Account"


def execute() -> None:
    frappe.reload_doc("excom", "doctype", "excom_channel_account")

    accounts = frappe.get_all(
        DOCTYPE,
        filters={"channel": "email"},
        fields=["name", "email_connected_app", "email_connected_user"],
    )
    if not accounts:
        return

    # Group by the (connected_app, user) pair that shares one Token Cache.
    groups: dict[tuple, list] = {}
    for acc in accounts:
        if not acc.email_connected_app or not acc.email_connected_user:
            continue
        groups.setdefault((acc.email_connected_app, acc.email_connected_user), []).append(acc.name)

    for (connected_app, user), names in groups.items():
        for name in names:
            # Idempotent: already migrated.
            if get_decrypted_password(DOCTYPE, name, "email_refresh_token", raise_exception=False):
                continue

            if len(names) > 1:
                # Ambiguous shared cache -- stop polling the wrong mailbox until
                # the operator re-authorizes this specific account.
                frappe.db.set_value(
                    DOCTYPE, name, "email_authorized", 0, update_modified=False
                )
                continue

            # Unambiguous: the single account owns whatever is in the shared cache.
            _copy_from_shared_cache(connected_app, user, name)

    frappe.db.commit()


def _copy_from_shared_cache(connected_app: str, user: str, account_name: str) -> None:
    token_cache_name = f"{connected_app}-{user}"
    if not frappe.db.exists("Token Cache", token_cache_name):
        frappe.db.set_value(DOCTYPE, account_name, "email_authorized", 0, update_modified=False)
        return

    token_cache = frappe.get_doc("Token Cache", token_cache_name)
    access_token = token_cache.get_password("access_token", raise_exception=False)
    refresh_token = token_cache.get_password("refresh_token", raise_exception=False)

    if not refresh_token:
        # Without a refresh token the account cannot sustain access -- re-auth.
        frappe.db.set_value(DOCTYPE, account_name, "email_authorized", 0, update_modified=False)
        return

    set_encrypted_password(DOCTYPE, account_name, access_token or "", "email_access_token")
    set_encrypted_password(DOCTYPE, account_name, refresh_token, "email_refresh_token")

    try:
        seconds = int(token_cache.expires_in or 3600)
    except (TypeError, ValueError):
        seconds = 3600

    frappe.db.set_value(
        DOCTYPE,
        account_name,
        {
            "email_token_expiry": add_to_date(now_datetime(), seconds=seconds),
            "email_token_type": "Bearer",
            "email_authorized": 1,
        },
        update_modified=False,
    )
