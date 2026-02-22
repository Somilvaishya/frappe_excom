frappe.ui.form.on("Excom Channel Account", {
	refresh(frm) {
		if (frm.doc.channel === "whatsapp" && !frm.is_new()) {
			frm.add_custom_button(__("Test Connection"), function () {
				frappe.call({
					method: "frappe.client.get_list",
					args: {
						doctype: "Excom Channel Account",
						filters: { name: frm.doc.name },
						fields: ["wa_url", "wa_version", "wa_phone_id"],
						limit_page_length: 1,
					},
					callback(r) {
						if (r.message && r.message.length) {
							frappe.msgprint(
								__("Account configured: {0}/{1}/{2}", [
									r.message[0].wa_url,
									r.message[0].wa_version,
									r.message[0].wa_phone_id,
								])
							);
						}
					},
				});
			});
		}
	},
});
