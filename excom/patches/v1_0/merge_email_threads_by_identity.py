"""
Merge email threads so there is one thread per person per account.

Before this patch, email threads used `email:{account}:{gmail_thread_id}`
as their thread_key, creating a separate Excom Thread for every Gmail
conversation. This patch consolidates them to use
`email:{account}:{omni_identity}` — one thread per person — and moves
all messages from duplicate threads into the surviving thread.
"""

import frappe


def execute() -> None:
    # Find email threads grouped by (omni_identity, account) that have duplicates
    groups = frappe.db.sql(
        """
        SELECT omni_identity, account, COUNT(*) AS cnt
        FROM `tabExcom Thread`
        WHERE channel = 'email'
          AND omni_identity IS NOT NULL
          AND omni_identity != ''
        GROUP BY omni_identity, account
        HAVING cnt > 1
        """,
        as_dict=True,
    )

    for group in groups:
        threads = frappe.db.sql(
            """
            SELECT name, thread_key, last_message_at, unread_count
            FROM `tabExcom Thread`
            WHERE channel = 'email'
              AND omni_identity = %(oi)s
              AND account = %(acc)s
            ORDER BY last_message_at DESC
            """,
            {"oi": group.omni_identity, "acc": group.account},
            as_dict=True,
        )

        if len(threads) < 2:
            continue

        # Keep the thread with the latest message
        survivor = threads[0]
        duplicates = threads[1:]

        total_unread = survivor.unread_count or 0
        for dup in duplicates:
            total_unread += dup.unread_count or 0

            # Move messages to the surviving thread
            frappe.db.sql(
                """
                UPDATE `tabExcom Message`
                SET thread = %(survivor)s
                WHERE thread = %(dup)s
                """,
                {"survivor": survivor.name, "dup": dup.name},
            )

            # Delete the duplicate thread
            frappe.db.sql(
                "DELETE FROM `tabExcom Thread` WHERE name = %(name)s",
                {"name": dup.name},
            )

        # Update the survivor's thread_key to the new format
        new_key = f"email:{group.account}:{group.omni_identity}"
        frappe.db.sql(
            """
            UPDATE `tabExcom Thread`
            SET thread_key = %(key)s,
                unread_count = %(unread)s
            WHERE name = %(name)s
            """,
            {"key": new_key, "unread": total_unread, "name": survivor.name},
        )

    # Also fix any remaining email threads whose thread_key uses
    # gmail_thread_id format (no duplicates but still wrong key)
    remaining = frappe.db.sql(
        """
        SELECT name, omni_identity, account, thread_key
        FROM `tabExcom Thread`
        WHERE channel = 'email'
          AND omni_identity IS NOT NULL
          AND omni_identity != ''
          AND thread_key NOT LIKE CONCAT('email:', account, ':', omni_identity)
        """,
        as_dict=True,
    )

    for row in remaining:
        new_key = f"email:{row.account}:{row.omni_identity}"
        # Check for conflict (another thread already has this key)
        existing = frappe.db.get_value(
            "Excom Thread", {"thread_key": new_key}, "name"
        )
        if existing and existing != row.name:
            # Merge into existing
            frappe.db.sql(
                "UPDATE `tabExcom Message` SET thread = %(target)s WHERE thread = %(src)s",
                {"target": existing, "src": row.name},
            )
            frappe.db.sql(
                "DELETE FROM `tabExcom Thread` WHERE name = %(name)s",
                {"name": row.name},
            )
        else:
            frappe.db.sql(
                "UPDATE `tabExcom Thread` SET thread_key = %(key)s WHERE name = %(name)s",
                {"key": new_key, "name": row.name},
            )

    frappe.db.commit()
