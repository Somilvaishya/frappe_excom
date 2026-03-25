frappe.ui.form.on("Excom Settings", {
  refresh(frm) {
    frm.add_custom_button(__("Sync ERPNext Entities"), () => {
      syncIdentities(frm);
    }, __("Identity Sync"));

    frm.change_custom_button_type(
      __("Sync ERPNext Entities"),
      __("Identity Sync"),
      "primary"
    );
  },
});

async function syncIdentities(frm) {
  const confirm = await new Promise((resolve) => {
    frappe.confirm(
      __(
        "This will create Omni Identities for all Customers, Suppliers, and Leads. " +
        "Existing identities will be skipped. Continue?"
      ),
      () => resolve(true),
      () => resolve(false)
    );
  });

  if (!confirm) return;

  frappe.show_progress(__("Identity Sync"), 0, 100, __("Starting..."));

  try {
    const res = await frappe.call({
      method: "excom.excom.api.identity_sync.run_identity_sync",
      freeze: false,
    });

    const data = res.message;
    if (data && !data.enqueued) {
      frappe.hide_progress();
      frappe.msgprint(data.message || __("A sync is already in progress."));
      return;
    }

    pollProgress();
  } catch (e) {
    frappe.hide_progress();
    frappe.msgprint(__("Failed to start sync. Check error log."));
  }
}

function pollProgress() {
  const interval = setInterval(async () => {
    try {
      const res = await frappe.call({
        method: "excom.excom.api.identity_sync.get_sync_status",
        freeze: false,
      });

      const data = res.message;
      if (!data || data.done) {
        clearInterval(interval);
        frappe.hide_progress();

        if (data && data.stats) {
          frappe.msgprint({
            title: __("Identity Sync Complete"),
            message: __(
              "Created: {0} | Skipped: {1} | Errors: {2}",
              [data.stats.created, data.stats.skipped, data.stats.errors]
            ),
            indicator: data.stats.errors > 0 ? "orange" : "green",
          });
        } else {
          frappe.msgprint(__("Sync completed."));
        }
        return;
      }

      const percent = data.percent || 0;
      const phase = data.phase || "";
      frappe.show_progress(
        __("Identity Sync"),
        percent,
        100,
        __("Processing {0}... ({1}%)", [phase, percent])
      );
    } catch {
      clearInterval(interval);
      frappe.hide_progress();
    }
  }, 2000);
}
