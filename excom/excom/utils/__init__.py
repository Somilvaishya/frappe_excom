"""Run on each event."""
import frappe
from frappe.utils import now_datetime, time_diff_in_seconds

from frappe.core.doctype.server_script.server_script_utils import EVENT_MAP


def run_server_script_for_doc_event(doc, event):
    """Run on each event."""
    if event not in EVENT_MAP:
        return

    if frappe.flags.in_install:
        return

    if frappe.flags.in_migrate:
        return
    
    if frappe.flags.in_uninstall:
        return

    notification = get_notifications_map().get(
        doc.doctype, {}
    ).get(EVENT_MAP[event], None)

    if notification:
        for notification_name in notification:
            frappe.get_doc(
                "WhatsApp Notification",
                notification_name
            ).send_template_message(doc)


def get_notifications_map():
    """Get mapping."""
    if frappe.flags.in_patch and not frappe.db.table_exists("WhatsApp Notification"):
        return {}

    notification_map = {}
    enabled_whatsapp_notifications = frappe.get_all(
        "WhatsApp Notification",
        fields=("name", "reference_doctype", "doctype_event", "notification_type"),
        filters={"disabled": 0},
    )
    for notification in enabled_whatsapp_notifications:
        if notification.notification_type == "DocType Event":
            notification_map.setdefault(
                notification.reference_doctype, {}
            ).setdefault(
                notification.doctype_event, []
            ).append(notification.name)

    frappe.cache().set_value("whatsapp_notification_map", notification_map)

    return notification_map


def trigger_whatsapp_notifications_all():
    """Run all."""
    trigger_whatsapp_notifications("All")


def trigger_whatsapp_notifications_hourly():
    """Run hourly."""
    trigger_whatsapp_notifications("Hourly")


def trigger_whatsapp_notifications_daily():
    """Run daily."""
    trigger_whatsapp_notifications("Daily")


def trigger_whatsapp_notifications_weekly():
    """Trigger notification."""
    trigger_whatsapp_notifications("Weekly")


def trigger_whatsapp_notifications_monthly():
    """Trigger notification."""
    trigger_whatsapp_notifications("Monthly")


def trigger_whatsapp_notifications_yearly():
    """Trigger notification."""
    trigger_whatsapp_notifications("Yearly")


def trigger_whatsapp_notifications_hourly_long():
    """Trigger notification."""
    trigger_whatsapp_notifications("Hourly Long")


def trigger_whatsapp_notifications_daily_long():
    """Trigger notification."""
    trigger_whatsapp_notifications("Daily Long")


def trigger_whatsapp_notifications_weekly_long():
    """Trigger notification."""
    trigger_whatsapp_notifications("Weekly Long")


def trigger_whatsapp_notifications_monthly_long():
    """Trigger notification."""
    trigger_whatsapp_notifications("Monthly Long")


def trigger_whatsapp_notifications(event):
    """Run cron."""
    wa_notify_list = frappe.get_list(
        "WhatsApp Notification",
        filters={
            "event_frequency": event,
            "disabled": 0,
        }
    )

    for wa in wa_notify_list:
        frappe.get_doc(
            "WhatsApp Notification",
            wa.name,
        ).send_scheduled_message()


def process_pending_whatsapp_notification_logs(batch_size=100):
    """Process delayed WhatsApp notifications queued in log table."""
    if frappe.flags.in_import or frappe.flags.in_patch:
        return

    now_dt = now_datetime()
    pending_logs = frappe.get_all(
        "WhatsApp Notification Log",
        filters={"status": "Pending"},
        fields=["name", "pending_since", "scheduled_for"],
        limit_page_length=batch_size,
        order_by="scheduled_for asc",
    )

    for log in pending_logs:
        updates = {}
        if log.pending_since:
            updates["pending_for_seconds"] = max(0, int(time_diff_in_seconds(now_dt, log.pending_since)))
        if updates:
            frappe.db.set_value("WhatsApp Notification Log", log.name, updates, update_modified=False)

    due_logs = [log for log in pending_logs if not log.scheduled_for or log.scheduled_for <= now_dt]
    for due in due_logs:
        _process_pending_whatsapp_notification_log(due.name)


def _process_pending_whatsapp_notification_log(log_name):
    """Process one pending notification log entry safely."""
    log = frappe.get_doc("WhatsApp Notification Log", log_name)
    if log.status != "Pending":
        return

    if not log.notification or not frappe.db.exists("WhatsApp Notification", log.notification):
        frappe.db.set_value(
            "WhatsApp Notification Log",
            log_name,
            {
                "status": "Cancelled",
                "reason": "Notification config missing",
                "processed_on": now_datetime(),
            },
            update_modified=True,
        )
        return

    if not log.reference_doctype or not log.reference_name:
        frappe.db.set_value(
            "WhatsApp Notification Log",
            log_name,
            {
                "status": "Skipped",
                "reason": "Reference document not available",
                "processed_on": now_datetime(),
            },
            update_modified=True,
        )
        return

    if not frappe.db.exists(log.reference_doctype, log.reference_name):
        frappe.db.set_value(
            "WhatsApp Notification Log",
            log_name,
            {
                "status": "Cancelled",
                "reason": "Reference document deleted",
                "processed_on": now_datetime(),
            },
            update_modified=True,
        )
        return

    reference_doc = frappe.get_doc(log.reference_doctype, log.reference_name)
    if hasattr(reference_doc, "docstatus") and reference_doc.docstatus == 2:
        frappe.db.set_value(
            "WhatsApp Notification Log",
            log_name,
            {
                "status": "Cancelled",
                "reason": "Reference document cancelled",
                "processed_on": now_datetime(),
            },
            update_modified=True,
        )
        return

    notification = frappe.get_doc("WhatsApp Notification", log.notification)
    try:
        notification.send_template_message(
            reference_doc,
            phone_no=log.to_number,
            ignore_condition=True,
            notification_log_name=log.name,
            force_send=True,
        )
        frappe.db.set_value(
            "WhatsApp Notification Log",
            log_name,
            {
                "status": "Sent",
                "processed_on": now_datetime(),
            },
            update_modified=True,
        )
    except Exception as e:
        frappe.db.set_value(
            "WhatsApp Notification Log",
            log_name,
            {
                "status": "Failed",
                "reason": str(e),
                "processed_on": now_datetime(),
            },
            update_modified=True,
        )
        frappe.log_error(frappe.get_traceback(), "WhatsApp delayed notification failed")


def get_channel_account(phone_id=None, channel='whatsapp', account_type='incoming'):
    """
    Get Excom Channel Account by phone_id or default for channel.

    Args:
        phone_id: WhatsApp phone number ID to look up by wa_phone_id field.
        channel: Channel type filter (e.g. 'whatsapp').
        account_type: 'incoming' or 'outgoing' to pick the default account.

    Returns:
        Excom Channel Account doc or None.
    """
    if phone_id:
        account_name = frappe.db.get_value(
            'Excom Channel Account', {'wa_phone_id': phone_id}, 'name'
        )
        if account_name:
            return frappe.get_doc("Excom Channel Account", account_name)

    account_field_type = 'is_default_incoming' if account_type == 'incoming' else 'is_default_outgoing'
    default_account_name = frappe.db.get_value(
        'Excom Channel Account',
        {account_field_type: 1, 'channel': channel},
        'name',
    )
    if default_account_name:
        return frappe.get_doc("Excom Channel Account", default_account_name)

    return None


def get_whatsapp_account(phone_id=None, account_type='incoming'):
    """Map whatsapp account with message (legacy – kept for backward compat)."""
    if phone_id:
        account_name = frappe.db.get_value('WhatsApp Account', {'phone_id': phone_id}, 'name')
        if account_name:
            return frappe.get_doc("WhatsApp Account", account_name)

    account_field_type = 'is_default_incoming' if account_type =='incoming' else 'is_default_outgoing' 
    default_account_name = frappe.db.get_value('WhatsApp Account', {account_field_type: 1}, 'name')
    if default_account_name:
        return frappe.get_doc("WhatsApp Account", default_account_name)

    return None

def format_number(number):
    """Format number."""
    if number.startswith("+"):
        number = number[1 : len(number)]

    return number
