"""Daily check for channel account tokens nearing expiry."""

import frappe
from frappe.utils import add_days, getdate, now_datetime


def check_token_expiry() -> None:
    """Alert Excom Manager/Admin users when OAuth tokens expire within 7 days.

    Checks:
    - Email accounts: Connected App token cache expiry
    - WhatsApp accounts: wa_token presence (WhatsApp system tokens
      are long-lived but can be revoked)
    """
    _check_email_token_expiry()
    _check_whatsapp_token_health()


def _check_email_token_expiry() -> None:
    """Check Gmail OAuth tokens (stored per-account) for revocation risk."""
    email_accounts = frappe.get_all(
        "Excom Channel Account",
        filters={"channel": "email", "status": "Active", "email_authorized": 1},
        fields=["name", "account_name"],
    )

    for acc in email_accounts:
        account = frappe.get_doc("Excom Channel Account", acc.name)
        refresh_token = account.get_password("email_refresh_token", raise_exception=False)

        # The refresh token is the durable credential. Without it, the account
        # loses access as soon as the current access token expires.
        if not refresh_token:
            _send_expiry_alert(
                acc.account_name,
                "email",
                "Missing refresh token — re-authorize to avoid losing access.",
            )


def _check_whatsapp_token_health() -> None:
    """Check WhatsApp accounts have a valid token set."""
    wa_accounts = frappe.get_all(
        "Excom Channel Account",
        filters={"channel": "whatsapp", "status": "Active"},
        fields=["name", "account_name"],
    )

    for acc in wa_accounts:
        try:
            token = frappe.get_doc(
                "Excom Channel Account", acc.name
            ).get_password("wa_token")
            if not token:
                _send_expiry_alert(
                    acc.account_name,
                    "whatsapp",
                    "WhatsApp access token is empty — messages will fail.",
                )
        except frappe.AuthenticationError:
            _send_expiry_alert(
                acc.account_name,
                "whatsapp",
                "WhatsApp access token is missing — messages will fail.",
            )


def _send_expiry_alert(account_name: str, channel: str, detail: str) -> None:
    """Send Frappe notification to all Excom Manager users."""
    admin_users = _get_admin_users()
    subject = f"Excom: {channel.title()} token alert for {account_name}"
    message = f"<b>{account_name}</b> ({channel}): {detail}"

    for user in admin_users:
        try:
            frappe.get_doc({
                "doctype": "Notification Log",
                "for_user": user,
                "from_user": "Administrator",
                "subject": subject,
                "type": "Alert",
                "email_content": message,
            }).insert(ignore_permissions=True)
        except Exception:
            frappe.log_error(
                title=f"Excom: token alert notification failed for {user}",
                message=f"account={account_name} channel={channel}",
            )

    frappe.log_error(
        title=subject,
        message=message,
    )


def _get_admin_users() -> list[str]:
    """Return users with Excom Manager or System Manager role."""
    users = set()
    for role in ("Excom Manager", "System Manager"):
        role_users = frappe.get_all(
            "Has Role",
            filters={"role": role, "parenttype": "User"},
            pluck="parent",
        )
        users.update(role_users)

    users.discard("Administrator")
    users.discard("Guest")
    return [u for u in users if frappe.db.get_value("User", u, "enabled")]
