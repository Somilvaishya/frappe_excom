// Excom Voice Telephony Global Desk Integration
frappe.provide("excom.voice");

$(document).ready(function() {
    if (!frappe.session || frappe.session.user === "Guest") return;

    // Listen for Incoming Call Screen Pop
    if (frappe.realtime) {
        frappe.realtime.on("excom_incoming_call", function(data) {
            console.log("[Excom Voice] Incoming Call received:", data);
            
            // Audio alert chime
            try {
                var audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
                audio.play().catch(function(e) {});
            } catch(e) {}

            var caller = data.from_number || "Unknown Caller";
            var msg = `
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="background:#10b981; color:#fff; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:18px;">
                        📞
                    </div>
                    <div>
                        <div style="font-weight:700; font-size:13px; color:#111827;">Incoming Call</div>
                        <div style="font-size:12px; color:#4b5563;">${caller}</div>
                    </div>
                </div>
            `;

            frappe.show_alert({
                message: msg,
                indicator: "green"
            }, 10);
        });

        frappe.realtime.on("excom_call_status_update", function(data) {
            console.log("[Excom Voice] Call status update:", data);
            if (data.status === "Ringing" && data.direction === "Outbound") {
                frappe.show_alert({
                    message: `📞 Outbound call ringing to ${data.to_number}... Check your phone.`,
                    indicator: "blue"
                }, 5);
            }
        });
    }
});