"""
Enforce global uniqueness on (linked_doctype, linked_name) across all
Omni Identity Link rows.

If the same ERP entity is linked to multiple Omni Identities, auto-merge
the newer identity into the older one, then add a DB unique index.
"""

import frappe


def execute():
    if not frappe.db.table_exists("tabOmni Identity Link"):
        return

    _deduplicate_links()
    _add_unique_index()


def _deduplicate_links():
    """Find entities linked to multiple identities and merge the newer into the older."""
    duplicates = frappe.db.sql(
        """
        SELECT linked_doctype, linked_name, GROUP_CONCAT(parent ORDER BY parent) AS parents
        FROM `tabOmni Identity Link`
        GROUP BY linked_doctype, linked_name
        HAVING COUNT(DISTINCT parent) > 1
        """,
        as_dict=True,
    )

    if not duplicates:
        return

    for dup in duplicates:
        parent_names = dup.parents.split(",")
        active_parents = []
        for p in parent_names:
            status = frappe.db.get_value("Omni Identity", p.strip(), "status")
            if status and status != "Merged":
                active_parents.append(p.strip())

        if len(active_parents) <= 1:
            _remove_orphaned_link_rows(dup.linked_doctype, dup.linked_name, active_parents)
            continue

        active_parents.sort()
        master_name = active_parents[0]

        for source_name in active_parents[1:]:
            try:
                source = frappe.get_doc("Omni Identity", source_name)
                master = frappe.get_doc("Omni Identity", master_name)
                source.merge_into(master)
            except Exception:
                frappe.log_error(
                    title=f"Identity merge failed during dedup: {source_name} -> {master_name}",
                )

        _remove_orphaned_link_rows(dup.linked_doctype, dup.linked_name, [master_name])

    frappe.db.commit()


def _remove_orphaned_link_rows(linked_doctype: str, linked_name: str, keep_parents: list):
    """Delete duplicate link rows, keeping only the one belonging to keep_parents."""
    if not keep_parents:
        return

    frappe.db.sql(
        """
        DELETE FROM `tabOmni Identity Link`
        WHERE linked_doctype = %(dt)s
        AND linked_name = %(dn)s
        AND parent NOT IN %(keep)s
        """,
        {"dt": linked_doctype, "dn": linked_name, "keep": keep_parents},
    )


def _add_unique_index():
    """Add a unique index on (linked_doctype, linked_name) if not already present."""
    existing_indexes = frappe.db.sql(
        "SHOW INDEX FROM `tabOmni Identity Link` WHERE Key_name = 'uniq_entity'",
        as_dict=True,
    )
    if existing_indexes:
        return

    frappe.db.sql(
        """
        ALTER TABLE `tabOmni Identity Link`
        ADD UNIQUE INDEX `uniq_entity` (`linked_doctype`, `linked_name`)
        """
    )
    frappe.db.commit()
