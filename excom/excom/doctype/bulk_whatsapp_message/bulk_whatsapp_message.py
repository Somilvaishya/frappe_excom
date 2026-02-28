# Bulk WhatsApp Messaging for Excom
# bulk_whatsapp_messaging.py

import frappe
from frappe import _
import json
from frappe.utils import cint, get_datetime, now
from frappe.model.document import Document
from frappe.model.naming import make_autoname

# Bulk WhatsApp messaging functionality migrated from legacy WhatsApp module

class BulkWhatsAppMessage(Document):
    def autoname(self):
        self.name = make_autoname("BULK-WA-.YYYY.-.#####")

    def validate(self):
        self.validate_template()
        self.validate_recipients()
        self.validate_template_variables()
        self.validate_scheduled_time()

    def validate_template(self):
        """Ensure a template is selected when use_template is checked."""
        if self.use_template and not self.template:
            frappe.throw(_("Template is required when 'Use Template' is checked"))

    def validate_recipients(self):
        """Ensure recipients exist and count matches actual rows."""
        if not self.recipients and not self.recipient_list:
            frappe.throw(_("At least one recipient or a recipient list is required"))

        if self.recipient_type == "Recipient List" and self.recipient_list:
            recipient_count = frappe.db.count(
                "WhatsApp Recipient", {"parent": self.recipient_list}
            )
            if recipient_count == 0:
                frappe.throw(_("Selected recipient list has no recipients"))
            self.recipient_count = recipient_count
        elif self.recipients:
            self.recipient_count = len(self.recipients)

    def validate_template_variables(self):
        """Validate template_variables is valid JSON when provided."""
        if not self.template_variables:
            return
        try:
            parsed = json.loads(self.template_variables)
            if not isinstance(parsed, (list, dict)):
                frappe.throw(
                    _("Template Variables must be a JSON array or object")
                )
        except (json.JSONDecodeError, ValueError):
            frappe.throw(
                _("Template Variables is not valid JSON")
            )

    def validate_scheduled_time(self):
        """Warn if scheduled_time is in the past."""
        if self.scheduled_time and get_datetime(self.scheduled_time) < get_datetime(now()):
            frappe.msgprint(
                _("Scheduled time is in the past. Messages will be sent immediately on submit."),
                indicator="orange",
                alert=True,
            )
    
    def on_submit(self):
        self.db_set("status", "Queued")
        self.queue_messages()
    
    def queue_messages(self):
        """Queue messages for sending"""
        if self.recipient_type == 'Recipient List' and self.recipient_list:
            # Fetch recipients from the recipient list
            recipients = frappe.get_all(
                "WhatsApp Recipient", 
                filters={"parent": self.recipient_list},
                fields=["mobile_number", "name", "recipient_name", "recipient_data"]
            )
            
            for recipient in recipients:
                frappe.enqueue_doc(
                    self.doctype, self.name,
                    "create_single_message",
                    "long", 4000,
                    recipient=recipient
                )
        else:
            # Use recipients from the current document
            for recipient in self.recipients:
                frappe.enqueue_doc(
                    self.doctype, self.name,
                    "create_single_message",
                    "long", 4000,
                    recipient=recipient
                )
    
    def create_single_message(self, recipient):
        """Create a single message in the queue"""
        # message_content = self.message_content
        
        # Replace variables in the message if any
        self.db_set("status", "In Progress")
        if recipient.get("recipient_data"):
            try:
                variables = json.loads(recipient.get("recipient_data", "{}"))
                # for var_name, var_value in variables.items():
                #     message_content = message_content.replace(f"{{{{{var_name}}}}}", str(var_value))
            except Exception as e:
                frappe.log_error(f"Error parsing recipient data: {str(e)}", "WhatsApp Bulk Messaging")
        
        # Create WhatsApp message
        wa_message = frappe.new_doc("WhatsApp Message")
        # wa_message.from_number = self.from_number
        wa_message.to = recipient.get("mobile_number")
        wa_message.message_type = "Text"
        # wa_message.message = message_content
        wa_message.flags.custom_ref_doc = json.loads(recipient.get("recipient_data", "{}"))
        wa_message.bulk_message_reference = self.name
        if self.whatsapp_account:
            wa_message.whatsapp_account = self.whatsapp_account
        
        # If template is being used
        if self.use_template:
            wa_message.template = self.template
            wa_message.message_type = 'Template'
            wa_message.use_template = self.use_template
            # Handle template variables if needed

            if recipient.get("recipient_data") and self.variable_type=='Unique':
                wa_message.body_param = recipient.get("recipient_data")
            elif self.template_variables and self.variable_type=='Common':
                wa_message.body_param = self.template_variables
            if self.attach:
                wa_message.attach = self.attach
        
        wa_message.status = "Queued"
        try:
            wa_message.insert(ignore_permissions=True)
            self.db_set("sent_count", cint(self.sent_count) + 1)
        except Exception:
            self.db_set("failed_count", cint(self.failed_count) + 1)
            frappe.log_error(
                title="Bulk WA message creation failed",
                message=frappe.get_traceback(),
            )

        processed = cint(self.sent_count) + cint(self.failed_count)
        if processed >= cint(self.recipient_count):
            final_status = "Completed" if cint(self.failed_count) == 0 else "Partially Failed"
            self.db_set({
                "status": final_status,
                "completed_at": now(),
            })

    def retry_failed(self):
        """Retry failed messages"""
        failed_messages = frappe.get_all(
            "WhatsApp Message",
            filters={
                "bulk_message_reference": self.name,
                "status": "Failed"
            },
            fields=["name"]
        )
        
        count = 0
        for msg in failed_messages:
            message_doc = frappe.get_doc("WhatsApp Message", msg.name)
            message_doc.status = "Queued"
            message_doc.save(ignore_permissions=True)
            count += 1
        
        frappe.msgprint(_("{0} messages have been requeued for sending").format(count))
        
    def get_progress(self):
        """Get sending progress for this bulk message"""
        total = self.recipient_count
        sent = frappe.db.count("WhatsApp Message", {
            "bulk_message_reference": self.name,
            "status": ["in", ["sent","delivered", "Success", "read"]]
        })
        failed = frappe.db.count("WhatsApp Message", {
            "bulk_message_reference": self.name,
            "status": "Failed"
        })
        queued = frappe.db.count("WhatsApp Message", {
            "bulk_message_reference": self.name,
            "status": "Queued"
        })
        
        return {
            "total": total,
            "sent": sent,
            "failed": failed,
            "queued": queued,
            "percent": (sent / total * 100) if total else 0
        }
