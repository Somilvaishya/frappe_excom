"""
Add missing database indexes for query performance.

Phase 1.3.1 — covers WhatsApp Message, WhatsApp Notification Log,
Excom Message, and Excom Thread.
"""

import frappe


def execute():
    indexes = [
        # WhatsApp Message — common query patterns
        ("tabWhatsApp Message", "idx_wa_msg_to_creation", ["`to`", "`creation`"]),
        ("tabWhatsApp Message", "idx_wa_msg_from_creation", ["`from`", "`creation`"]),
        ("tabWhatsApp Message", "idx_wa_msg_message_id", ["`message_id`"]),
        ("tabWhatsApp Message", "idx_wa_msg_status_type_from", ["`status`", "`type`", "`from`"]),
        ("tabWhatsApp Message", "idx_wa_msg_bulk_ref", ["`bulk_message_reference`"]),

        # WhatsApp Notification Log — pending processor query
        ("tabWhatsApp Notification Log", "idx_wa_notif_log_status_sched", ["`status`", "`scheduled_for`"]),

        # Excom Message — idempotency + thread listing
        ("tabExcom Message", "idx_excom_msg_provider_id", ["`provider_message_id`"]),
        ("tabExcom Message", "idx_excom_msg_thread_creation", ["`thread`", "`creation`"]),

        # Excom Thread — inbox query + identity lookup
        ("tabExcom Thread", "idx_excom_thread_key", ["`thread_key`"]),
        ("tabExcom Thread", "idx_excom_thread_last_msg", ["`last_message_at`"]),
        ("tabExcom Thread", "idx_excom_thread_identity_ch_acc", ["`omni_identity`", "`channel`", "`account`"]),
    ]

    for table, idx_name, columns in indexes:
        if not frappe.db.has_index(table, idx_name):
            col_str = ", ".join(columns)
            frappe.db.sql_ddl(
                f"CREATE INDEX `{idx_name}` ON `{table}` ({col_str})"
            )
