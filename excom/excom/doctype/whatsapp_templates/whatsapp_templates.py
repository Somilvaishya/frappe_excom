"""Create whatsapp template."""

# Copyright (c) 2022, Shridhar Patil and contributors
# For license information, please see license.txt
import os
import json
import frappe
import magic
from frappe import _
from frappe.model.document import Document
from frappe.integrations.utils import make_post_request, make_request
from frappe.desk.form.utils import get_pdf_link

from excom.excom.utils import get_channel_account, get_wa_credentials

class WhatsAppTemplates(Document):
    """Create whatsapp template."""

    def validate(self):
        self.set_whatsapp_account()
        if not self.language_code or self.has_value_changed("language"):
            lang_code = frappe.db.get_value("Language", self.language) or "en"
            self.language_code = lang_code.replace("-", "_")

        self.validate_button_count()

        if self.header_type in ["IMAGE", "DOCUMENT"] and self.sample:
            self.get_session_id()
            self.get_media_id()

        if not self.is_new():
            self.update_template()

    def validate_button_count(self):
        """Enforce Meta's button limits: max 3 Quick Reply, max 2 CTA."""
        if not self.buttons:
            return
        quick_reply = sum(1 for b in self.buttons if b.button_type == "Quick Reply")
        cta = sum(1 for b in self.buttons if b.button_type in ("Visit Website", "Call Phone"))
        if quick_reply > 3:
            frappe.throw(
                _("Quick Reply buttons cannot exceed 3 (found {0})").format(quick_reply)
            )
        if cta > 2:
            frappe.throw(
                _("CTA buttons (Visit Website / Call Phone) cannot exceed 2 (found {0})").format(cta)
            )

    def set_whatsapp_account(self):
        """Set channel account to default if missing."""
        if not self.whatsapp_account:
            default_account = get_channel_account(channel='whatsapp', account_type='outgoing')
            if not default_account:
                frappe.throw(_("Please set a default outgoing WhatsApp Channel Account"))
            else:
                self.whatsapp_account = default_account.name

    def get_session_id(self):
        """Upload media to Meta for template header sample."""
        creds = self._get_creds()
        file_path = self.get_absolute_path(self.sample)
        mime = magic.Magic(mime=True)
        file_type = mime.from_file(file_path)

        payload = {
            'file_length': os.path.getsize(file_path),
            'file_type': file_type,
            'messaging_product': 'whatsapp'
        }

        response = make_post_request(
            f"{creds['url']}/{creds['version']}/{creds['app_id']}/uploads",
            headers=creds['headers'],
            data=json.loads(json.dumps(payload))
        )
        self._session_id = response['id']

    def get_media_id(self):
        creds = self._get_creds()
        headers = {"authorization": f"OAuth {creds['token']}"}
        file_name = self.get_absolute_path(self.sample)
        with open(file_name, mode='rb') as file:
            file_content = file.read()

        response = make_post_request(
            f"{creds['url']}/{creds['version']}/{self._session_id}",
            headers=headers,
            data=file_content
        )
        self._media_id = response['h']

    def get_absolute_path(self, file_name):
        if file_name.startswith('/files/'):
            file_path = f'{frappe.utils.get_bench_path()}/sites/{frappe.utils.get_site_base_path()[2:]}/public{file_name}'
        if file_name.startswith('/private/'):
            file_path = f'{frappe.utils.get_bench_path()}/sites/{frappe.utils.get_site_base_path()[2:]}{file_name}'
        return file_path


    def after_insert(self):
        if self.template_name:
            self.actual_name = self.template_name.lower().replace(" ", "_")

        creds = self._get_creds()
        data = {
            "name": self.actual_name,
            "language": self.language_code,
            "category": self.category,
            "components": [],
        }

        body = {
            "type": "BODY",
            "text": self.template,
        }
        if self.sample_values:
            body.update({"example": {"body_text": [self.sample_values.split(",")]}})

        data["components"].append(body)
        if self.header_type:
            data["components"].append(self.get_header())

        if self.footer:
            data["components"].append({"type": "FOOTER", "text": self.footer})

        if self.buttons:
            button_block = {"type": "BUTTONS", "buttons": []}
            for btn in self.buttons:
                b = {"type": btn.button_type, "text": btn.button_label}

                if btn.button_type == "Visit Website":
                    b["type"] = "URL"
                    b["url"] = btn.website_url
                    if btn.url_type == "Dynamic" and btn.example_url:
                        b["example"] = btn.example_url.split(",")
                elif btn.button_type == "Call Phone":
                    b["type"] = "PHONE_NUMBER"
                    b["phone_number"] = btn.phone_number
                elif btn.button_type == "Quick Reply":
                    b["type"] = "QUICK_REPLY"

                button_block["buttons"].append(b)

            data["components"].append(button_block)

        try:
            response = make_post_request(
                f"{creds['url']}/{creds['version']}/{creds['business_id']}/message_templates",
                headers=creds['headers'],
                data=json.dumps(data),
            )
            self.id = response["id"]
            self.status = response["status"]
            self.db_update()
        except Exception:
            res = frappe.flags.integration_request.json().get("error", {})
            error_message = res.get("error_user_msg", res.get("message"))
            frappe.throw(
                msg=error_message,
                title=res.get("error_user_title", "Error"),
            )

    def update_template(self):
        """Update template on Meta."""
        creds = self._get_creds()
        data = {"components": []}

        body = {
            "type": "BODY",
            "text": self.template,
        }
        if self.sample_values:
            body.update({"example": {"body_text": [self.sample_values.split(",")]}})
        data["components"].append(body)
        if self.header_type:
            data["components"].append(self.get_header())
        if self.footer:
            data["components"].append({"type": "FOOTER", "text": self.footer})
        if self.buttons:
            button_block = {"type": "BUTTONS", "buttons": []}
            for btn in self.buttons:
                b = {"type": btn.button_type, "text": btn.button_label}

                if btn.button_type == "Visit Website":
                    b["type"] = "URL"
                    b["url"] = btn.website_url
                    if btn.url_type == "Dynamic" and btn.example_url:
                        b["example"] = btn.example_url.split(",")
                elif btn.button_type == "Call Phone":
                    b["type"] = "PHONE_NUMBER"
                    b["phone_number"] = btn.phone_number
                elif btn.button_type == "Quick Reply":
                    b["type"] = "QUICK_REPLY"

                button_block["buttons"].append(b)

            data["components"].append(button_block)

        try:
            make_post_request(
                f"{creds['url']}/{creds['version']}/{self.id}",
                headers=creds['headers'],
                data=json.dumps(data),
            )
        except Exception as e:
            raise e

    def _get_creds(self) -> dict:
        """Get WhatsApp API credentials from the linked Excom Channel Account."""
        account_doc = frappe.get_doc("Excom Channel Account", self.whatsapp_account)
        return get_wa_credentials(account_doc)

    def on_trash(self):
        creds = self._get_creds()
        url = f"{creds['url']}/{creds['version']}/{creds['business_id']}/message_templates?name={self.actual_name}"
        try:
            make_request("DELETE", url, headers=creds['headers'])
        except Exception:
            res = frappe.flags.integration_request.json().get("error", {})
            if res.get("error_user_title") == "Message Template Not Found":
                frappe.msgprint(
                    "Deleted locally", res.get("error_user_title", "Error"), alert=True
                )
            else:
                frappe.throw(
                    msg=res.get("error_user_msg"),
                    title=res.get("error_user_title", "Error"),
                )

    def get_header(self):
        """Get header format."""
        header = {"type": "header", "format": self.header_type}
        if self.header_type == "TEXT":
            header["text"] = self.header
            if self.sample:
                samples = self.sample.split(", ")
                header.update({"example": {"header_text": samples}})
        else:
            pdf_link = ''
            if not self.sample:
                key = frappe.get_doc(self.doctype, self.name).get_document_share_key()
                link = get_pdf_link(self.doctype, self.name)
                pdf_link = f"{frappe.utils.get_url()}{link}&key={key}"
            header.update({"example": {"header_handle": [self._media_id]}})

        return header

@frappe.whitelist()
def fetch():
    """Fetch templates from Meta for all active WhatsApp channel accounts."""
    accounts = frappe.get_all(
        'Excom Channel Account',
        filters={'status': 'Active', 'channel': 'WhatsApp'},
        fields=['name'],
    )

    for acct in accounts:
        account_doc = frappe.get_doc("Excom Channel Account", acct.name)
        creds = get_wa_credentials(account_doc)
        token = creds['token']
        url = creds['url']
        version = creds['version']
        business_id = creds['business_id']

        headers = {"authorization": f"Bearer {token}", "content-type": "application/json"}

        try:
            response = make_request(
                "GET",
                f"{url}/{version}/{business_id}/message_templates",
                headers=headers,
            )

            for template in response["data"]:
                # set flag to insert or update
                flags = 1
                if frappe.db.exists("WhatsApp Templates", {"actual_name": template["name"]}):
                    doc = frappe.get_doc("WhatsApp Templates", {"actual_name": template["name"]})
                else:
                    flags = 0
                    doc = frappe.new_doc("WhatsApp Templates")
                    doc.template_name = template["name"]
                    doc.actual_name = template["name"]

                doc.status = template["status"]
                doc.language_code = template["language"]
                doc.category = template["category"]
                doc.id = template["id"]
                doc.whatsapp_account = acct.name

                # update components
                for component in template["components"]:

                    # update header
                    if component["type"] == "HEADER":
                        doc.header_type = component["format"]

                        # if format is text update sample text
                        if component["format"] == "TEXT":
                            doc.header = component["text"]
                    # Update footer text
                    elif component["type"] == "FOOTER":
                        doc.footer = component["text"]

                    # update template text
                    elif component["type"] == "BODY":
                        doc.template = component["text"]
                        if component.get("example"):
    			            # Check if 'body_text' exists before trying to access it
                            if component["example"].get("body_text"):
                                doc.sample_values = ",".join(
            	                    component["example"]["body_text"][0]
                    	        )

                    # Update buttons
                    elif component["type"] == "BUTTONS":
                        doc.set("buttons", [])
                        frappe.db.delete("WhatsApp Button", {"parent": doc.name, "parenttype": "WhatsApp Templates"})
                        typeMap = {
                            "URL": "Visit Website",
                            "PHONE_NUMBER": "Call Phone",
                            "QUICK_REPLY": "Quick Reply",
                            "FLOW": "Flow"
                        }

                        for i, button in enumerate(component.get("buttons", []), start=1):
                            btn = {}
                            btn["button_type"] = typeMap[button["type"]]
                            btn["button_label"] = button.get("text")
                            btn["sequence"] = i

                            if button["type"] == "URL":
                                btn["website_url"] = button.get("url")
                                if "{{" in btn["website_url"]:
                                    btn["url_type"] = "Dynamic"
                                else:
                                    btn["url_type"] = "Static"

                                if button.get("example"):
                                    btn["example_url"] = ",".join(button["example"])
                            elif button["type"] == "PHONE_NUMBER":
                                btn["phone_number"] = button.get("phone_number")
                            elif button["type"] == "FLOW":
                                btn["flow"] = button.get("flow")

                            doc.append("buttons", btn)

                upsert_doc_without_hooks(doc, "WhatsApp Button", "buttons")

            return "Successfully fetched templates from meta"

        except Exception as e:
            # Check if frappe.flags.integration_request is set and has a .json() method
            if hasattr(frappe.flags.integration_request, 'json'):
                try:
                    res = frappe.flags.integration_request.json().get("error", {})
                    error_message = res.get("error_user_msg", res.get("message"))
                    frappe.throw(
                        msg=error_message,
                        title=res.get("error_user_title", "Error"),
                    )
                except (json.JSONDecodeError, KeyError):
                    # Handle cases where the response is not valid JSON or lacks the 'error' key
                    frappe.throw(f"An unexpected error occurred while fetching templates: {e}")
            else:
                # Handle cases where frappe.flags.integration_request doesn't exist or isn't a proper response object
                frappe.throw(f"An unexpected server error occurred: {e}")

def upsert_doc_without_hooks(doc, child_dt, child_field):
    """Insert or update a parent document and its children without hooks."""
    if frappe.db.exists(doc.doctype, doc.name):
        doc.db_update()
        frappe.db.delete(child_dt, {"parent": doc.name, "parenttype": doc.doctype})
    else:
        doc.db_insert()
    for d in doc.get(child_field):
        d.parent = doc.name
        d.parenttype = doc.doctype
        d.parentfield = child_field
        d.db_insert()
    frappe.db.commit()
