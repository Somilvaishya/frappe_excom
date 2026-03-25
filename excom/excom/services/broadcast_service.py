"""
Broadcast execution service.

Handles sending broadcasts to subscriber lists via WhatsApp or Email,
including per-subscriber Jinja rendering and unsubscribe footer injection.
"""

import hashlib
import hmac
import json

import frappe
from frappe import _
from frappe.utils import now_datetime, get_url


def execute_broadcast(broadcast_name: str):
    """
    Background job: send a broadcast to all active subscribers.

    Iterates each subscribed member, renders content per-subscriber,
    dispatches via the appropriate channel, and tracks results.
    """
    broadcast = frappe.get_doc("Excom Broadcast", broadcast_name)

    if broadcast.docstatus != 1 or broadcast.status not in ("Queued", "Sending"):
        return

    broadcast.db_set("status", "Sending", update_modified=False)

    subscribers = frappe.get_all(
        "Excom Subscriber",
        filters={
            "subscriber_list": broadcast.subscriber_list,
            "status": "Subscribed",
        },
        pluck="omni_identity",
    )

    sent, failed = 0, 0

    for oi_name in subscribers:
        try:
            if broadcast.channel == "Email":
                success = _send_email_to_subscriber(broadcast, oi_name)
            elif broadcast.channel == "WhatsApp":
                success = _send_whatsapp_to_subscriber(broadcast, oi_name)
            else:
                success = False

            if success:
                sent += 1
            else:
                failed += 1
        except Exception as e:
            failed += 1
            _log_delivery(broadcast.name, oi_name, "Failed", error=str(e))
            frappe.log_error(
                title=f"Broadcast send failed: {broadcast_name} -> {oi_name}",
            )

        if (sent + failed) % 10 == 0:
            broadcast.db_set(
                {"sent_count": sent, "failed_count": failed},
                update_modified=False,
            )
            frappe.db.commit()

    final_status = "Completed"
    if failed > 0 and sent == 0:
        final_status = "Failed"
    elif failed > 0:
        final_status = "Partially Failed"

    broadcast.db_set(
        {
            "status": final_status,
            "sent_count": sent,
            "failed_count": failed,
        },
        update_modified=True,
    )
    frappe.db.commit()


def render_email_body(body_template: str, omni_identity_name: str) -> str:
    """
    Render an email body template with full subscriber context.

    Available Jinja variables:
        subscriber: Omni Identity doc
        customer:   first linked Customer (or None)
        lead:       first linked Lead (or None)
        supplier:   first linked Supplier (or None)
        contact:    first linked Contact (or None)
        frappe:     frappe module (for frappe.utils)

    Args:
        body_template: Jinja HTML template string
        omni_identity_name: Omni Identity name

    Returns:
        Rendered HTML string
    """
    context = _build_subscriber_context(omni_identity_name)
    return frappe.render_template(body_template, context)


def generate_unsubscribe_token(
    subscriber_list: str, omni_identity: str
) -> str:
    """
    Generate an HMAC-SHA256 token for stateless unsubscribe verification.

    The token encodes subscriber_list + omni_identity signed with the
    site's encryption key. No DB storage needed.
    """
    secret = frappe.utils.password.get_encryption_key()
    message = f"{subscriber_list}:{omni_identity}"
    return hmac.new(
        secret.encode(), message.encode(), hashlib.sha256
    ).hexdigest()


def verify_unsubscribe_token(
    subscriber_list: str, omni_identity: str, token: str
) -> bool:
    """Verify an unsubscribe token."""
    expected = generate_unsubscribe_token(subscriber_list, omni_identity)
    return hmac.compare_digest(expected, token)


# ---------------------------------------------------------------------------
# Email sending
# ---------------------------------------------------------------------------


def _send_email_to_subscriber(broadcast, omni_identity_name: str) -> bool:
    """Send a single email to a subscriber with Jinja rendering + unsubscribe footer."""
    identity = frappe.get_doc("Omni Identity", omni_identity_name)
    email = identity.primary_email
    if not email:
        _log_delivery(
            broadcast.name, omni_identity_name, "Skipped",
            recipient="", error="No email address",
        )
        return False

    rendered_body = render_email_body(broadcast.email_body, omni_identity_name)

    footer = _build_unsubscribe_footer(
        broadcast.subscriber_list,
        omni_identity_name,
        broadcast.sender_company,
    )
    full_body = rendered_body + footer

    account_name = broadcast.sender_email_account
    if account_name:
        from excom.excom.services import gmail_service

        gmail_service.send_email(
            account_name=account_name,
            to=email,
            subject=broadcast.email_subject,
            body_html=full_body,
        )
    else:
        frappe.sendmail(
            recipients=[email],
            subject=broadcast.email_subject,
            message=full_body,
            now=True,
        )

    _log_delivery(broadcast.name, omni_identity_name, "Sent", recipient=email)
    return True


def _build_unsubscribe_footer(
    subscriber_list: str, omni_identity: str, company_name: str = ""
) -> str:
    """Build CAN-SPAM compliant unsubscribe footer HTML."""
    token = generate_unsubscribe_token(subscriber_list, omni_identity)
    site_url = get_url()
    unsub_url = (
        f"{site_url}/api/method/excom.excom.api.unsubscribe.unsubscribe"
        f"?list={subscriber_list}&oi={omni_identity}&token={token}"
    )

    address = ""
    if company_name:
        company = frappe.db.get_value(
            "Company",
            company_name,
            ["company_name", "address_html"],
            as_dict=True,
        )
        if company and company.address_html:
            address = company.address_html
        elif company:
            address = company.company_name

    return f"""
    <div style="margin-top:30px; padding-top:15px; border-top:1px solid #eee;
                font-size:12px; color:#888; text-align:center;">
        <p>You received this email because you are subscribed to {subscriber_list}.</p>
        <p><a href="{unsub_url}" style="color:#888;">Unsubscribe</a></p>
        {f'<p>{address}</p>' if address else ''}
    </div>
    """


# ---------------------------------------------------------------------------
# WhatsApp sending
# ---------------------------------------------------------------------------


def _send_whatsapp_to_subscriber(broadcast, omni_identity_name: str) -> bool:
    """Send a WhatsApp template message to a subscriber with variables and header media."""
    identity = frappe.get_doc("Omni Identity", omni_identity_name)
    phone = identity.primary_whatsapp or identity.primary_phone
    if not phone:
        _log_delivery(
            broadcast.name, omni_identity_name, "Skipped",
            recipient="", error="No phone number",
        )
        return False

    wa_account_name = broadcast.get("wa_channel_account")
    if wa_account_name:
        account = frappe.get_doc("Excom Channel Account", wa_account_name)
    else:
        from excom.excom.utils import get_channel_account
        account = get_channel_account(channel="whatsapp")

    if not account:
        _log_delivery(
            broadcast.name, omni_identity_name, "Failed",
            recipient=phone, error="No WhatsApp account configured",
        )
        return False

    template = frappe.get_doc("WhatsApp Templates", broadcast.wa_template)

    variables = json.loads(broadcast.get("wa_template_variables") or "[]")
    header_media = broadcast.get("wa_header_media") or ""

    from excom.excom.api.chat import _build_template_components

    components = _build_template_components(template, variables, header_media)

    from excom.excom.services.whatsapp_service import send_template_message

    result = send_template_message(
        account=account,
        to=phone,
        template_name=template.actual_name or template.name,
        language_code=template.language or "en_US",
        components=components,
    )

    _log_delivery(broadcast.name, omni_identity_name, "Sent", recipient=phone)
    return True


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


def _build_subscriber_context(omni_identity_name: str) -> dict:
    """
    Build full Jinja context for a subscriber.

    Loads the Omni Identity and all linked ERP entities
    (Customer, Lead, Supplier, Contact).
    """
    identity = frappe.get_doc("Omni Identity", omni_identity_name)

    context = {
        "subscriber": identity,
        "customer": None,
        "lead": None,
        "supplier": None,
        "contact": None,
        "frappe": frappe._dict({"utils": frappe.utils}),
    }

    for link in identity.get("linked_entities", []):
        dt = link.linked_doctype
        key_map = {
            "Customer": "customer",
            "Lead": "lead",
            "Supplier": "supplier",
            "Contact": "contact",
        }
        key = key_map.get(dt)
        if key and context[key] is None:
            try:
                context[key] = frappe.get_cached_doc(dt, link.linked_name)
            except frappe.DoesNotExistError:
                pass

    return context


def _log_delivery(
    broadcast_name: str,
    omni_identity: str,
    status: str,
    recipient: str = "",
    error: str = "",
):
    """Create a Broadcast Log entry for per-recipient tracking."""
    frappe.get_doc({
        "doctype": "Excom Broadcast Log",
        "broadcast": broadcast_name,
        "omni_identity": omni_identity,
        "status": status,
        "recipient_address": recipient,
        "error_message": error[:500] if error else "",
        "sent_at": now_datetime() if status == "Sent" else None,
    }).insert(ignore_permissions=True)
