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

		if (frm.doc.channel === "email" && !frm.is_new()) {
			if (frm.doc.email_authorized) {
				frm.add_custom_button(__("Check Gmail Connection"), function () {
					frappe.call({
						method: "excom.excom.api.email.check_gmail_connection",
						args: { account_name: frm.doc.name },
						callback(r) {
							if (r.message && r.message.success) {
								frappe.msgprint(__("Gmail connection is active. Email: {0}", [r.message.email]));
							} else {
								frappe.msgprint(__("Gmail connection failed. Please re-authorize."));
							}
						},
					});
				});
			}
		}
	},

	email_authorize_button(frm) {
		if (!frm.doc.email_connected_app || !frm.doc.email_connected_user) {
			frappe.msgprint(__("Please set Connected App and Connected User first."));
			return;
		}

		frappe.model.with_doc("Connected App", frm.doc.email_connected_app, () => {
			const connectedApp = frappe.get_doc("Connected App", frm.doc.email_connected_app);
			frappe.call({
				doc: connectedApp,
				method: "initiate_web_application_flow",
				args: {
					success_uri: window.location.pathname,
					user: frm.doc.email_connected_user,
				},
				callback(r) {
					if (r.message) {
						window.open(r.message, "_self");
					}
				},
			});
		});
	},
});
