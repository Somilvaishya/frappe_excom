"""Pick up Excom Broadcast documents submitted with a future ``scheduled_at``."""

from __future__ import annotations

import frappe
from frappe.utils import now_datetime


def process_due_scheduled_broadcasts() -> None:
    """Enqueue sends for submitted broadcasts whose ``scheduled_at`` time has passed.

    Uses a conditional SQL update so only one scheduler pass transitions a row
    from *Scheduled* → *Queued*, avoiding duplicate sends if workers overlap.
    """
    if frappe.flags.in_install or frappe.flags.in_migrate:
        return

    now = now_datetime()
    names = frappe.get_all(
        "Excom Broadcast",
        filters={
            "docstatus": 1,
            "status": "Scheduled",
            "scheduled_at": ("<=", now),
        },
        pluck="name",
        order_by="scheduled_at asc",
        limit=100,
    )

    for name in names:
        frappe.db.sql(
            """
            UPDATE `tabExcom Broadcast`
            SET `status` = 'Queued'
            WHERE `name` = %(name)s
              AND `docstatus` = 1
              AND `status` = 'Scheduled'
              AND `scheduled_at` IS NOT NULL
              AND `scheduled_at` <= %(now)s
            """,
            {"name": name, "now": now},
        )
        rc = frappe.db.sql("SELECT ROW_COUNT() AS rc", as_dict=True)
        if not rc or (rc[0].get("rc") or 0) < 1:
            continue

        frappe.db.commit()
        frappe.enqueue(
            "excom.excom.services.broadcast_service.execute_broadcast",
            broadcast_name=name,
            queue="long",
            timeout=3600,
            is_async=True,
        )
