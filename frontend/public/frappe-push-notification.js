/**
 * Frappe Push Notification client for Excom.
 *
 * Adapted from raven/frontend/public/frappe-push-notification.js.
 * Handles FCM token lifecycle via Frappe Cloud relay or Excom Cloud,
 * depending on the push_notification_service setting in boot.
 */

import { initializeApp } from "firebase/app"
import {
    getMessaging,
    getToken,
    isSupported,
    deleteToken,
    onMessage as onFCMMessage,
} from "firebase/messaging"

/** Normalize relay get_config body: Frappe may use { message: { ... } } or stringify `message`. */
function unwrapRelayJson(json) {
    if (json == null || typeof json !== "object") return null
    let m = json.message
    if (typeof m === "string") {
        try {
            m = JSON.parse(m)
        } catch {
            return null
        }
    }
    if (m != null && typeof m === "object" && !Array.isArray(m)) {
        return m
    }
    return json
}

class FrappePushNotification {
    static get relayServerBaseURL() {
        return window.frappe?.boot?.push_relay_server_url
    }

    constructor(projectName) {
        this.projectName = projectName
        this.webConfig = null
        this.vapidPublicKey = ""
        this.token = null
        this.initialized = false
        this.messaging = null
        this.serviceWorkerRegistration = null
        this.onMessageHandler = null
        /** @type {object | null} Cached payload from notification_relay.api.get_config */
        this._relayConfigPayload = null
    }

    async initialize(serviceWorkerRegistration) {
        if (this.initialized) return
        this.serviceWorkerRegistration = serviceWorkerRegistration
        const config = await this.fetchWebConfig()
        this.messaging = getMessaging(initializeApp(config))
        this.onMessage(this.onMessageHandler)
        this.initialized = true
    }

    async appendConfigToServiceWorkerURL(url, parameterName = "config") {
        const config = await this.fetchWebConfig()
        const encoded = encodeURIComponent(JSON.stringify(config))
        return `${url}?${parameterName}=${encoded}`
    }

    /**
     * Load and cache relay get_config once (config + VAPID key) for Frappe Cloud path.
     *
     * Uses same-origin `get_frappe_relay_push_config` so the browser does not call the
     * relay directly (avoids CORS and surfaces clear errors when `push_relay_server_url`
     * is wrongly set to this site's URL). The server runs relay registration
     * (`auth.get_credential`) when API key/secret are still empty, matching desk.
     */
    async _loadFrappeRelayConfig() {
        if (this._relayConfigPayload != null) return this._relayConfigPayload

        const response = await fetch(
            "/api/method/excom.excom.api.notification.get_frappe_relay_push_config",
            {
                method: "GET",
                credentials: "same-origin",
                headers: {
                    Accept: "application/json",
                    "X-Frappe-CSRF-Token": window.csrf_token || "",
                },
            }
        )
        const json = await response.json().catch(() => ({}))

        if (!response.ok || json.exc || json.exception) {
            const fromServer =
                typeof json.message === "string" && json.message.trim()
                    ? json.message
                    : typeof json.exception === "string"
                      ? json.exception
                      : null
            throw new Error(
                fromServer ||
                    `Push relay config failed (${response.status}). Check Integrations > Push Notification Settings, push_relay_server_url in site_config, and project "${this.projectName}".`
            )
        }

        const data =
            json.message != null &&
            typeof json.message === "object" &&
            !Array.isArray(json.message)
                ? json.message
                : unwrapRelayJson(json) || json

        const config = data?.config
        const vapid = data?.vapid_public_key

        if (config == null || typeof config !== "object") {
            throw new Error(
                "Push relay did not return Firebase web config. Is this project registered on the relay?"
            )
        }
        if (vapid == null || String(vapid).trim() === "") {
            throw new Error(
                "Push relay did not return a VAPID public key. Check relay / project registration (project name must match Excom)."
            )
        }

        this._relayConfigPayload = {
            config,
            vapid_public_key: String(vapid).trim(),
        }
        return this._relayConfigPayload
    }

    async fetchWebConfig() {
        if (this.webConfig != null) return this.webConfig

        try {
            if (window.frappe?.boot?.push_notification_service === "Excom Cloud") {
                const raw = window.frappe?.boot?.firebase_client_config
                if (!raw) {
                    throw new Error("Excom Cloud push: firebase_client_config missing from boot.")
                }
                this.webConfig = JSON.parse(raw)
                return this.webConfig
            }
            const { config } = await this._loadFrappeRelayConfig()
            this.webConfig = config
            return this.webConfig
        } catch (e) {
            if (e instanceof Error) throw e
            throw new Error("Push Notification Relay is not configured properly on your site.")
        }
    }

    async fetchVapidPublicKey() {
        if (this.vapidPublicKey !== "") return this.vapidPublicKey

        try {
            if (window.frappe?.boot?.push_notification_service === "Excom Cloud") {
                const k = window.frappe?.boot?.vapid_public_key
                if (!k || String(k).trim() === "") {
                    throw new Error("Excom Cloud push: vapid_public_key missing from boot.")
                }
                this.vapidPublicKey = String(k).trim()
                return this.vapidPublicKey
            }
            const { vapid_public_key } = await this._loadFrappeRelayConfig()
            this.vapidPublicKey = vapid_public_key
            return this.vapidPublicKey
        } catch (e) {
            if (e instanceof Error) throw e
            throw new Error("Push Notification Relay is not configured properly on your site.")
        }
    }

    onMessage(callback) {
        if (callback == null) return
        this.onMessageHandler = callback
        if (this.messaging == null) return
        onFCMMessage(this.messaging, this.onMessageHandler)
    }

    isNotificationEnabled() {
        return localStorage.getItem(`firebase_token_${this.projectName}`) !== null
    }

    async enableNotification() {
        if (!(await isSupported())) {
            throw new Error("Push notifications are not supported on your device")
        }
        if (this.token != null) {
            return { permission_granted: true, token: this.token }
        }

        const permission = await Notification.requestPermission()
        if (permission !== "granted") {
            return { permission_granted: false, token: "" }
        }

        const oldToken = localStorage.getItem(`firebase_token_${this.projectName}`)
        const vapidKey = await this.fetchVapidPublicKey()
        if (
            vapidKey == null ||
            typeof vapidKey !== "string" ||
            vapidKey.trim() === ""
        ) {
            throw new Error("VAPID key is missing — cannot register for web push.")
        }
        if (this.messaging == null || this.serviceWorkerRegistration == null) {
            throw new Error("Push messaging is not initialized — reload the page and try again.")
        }

        const newToken = await getToken(this.messaging, {
            vapidKey: vapidKey.trim(),
            serviceWorkerRegistration: this.serviceWorkerRegistration,
        })

        if (oldToken !== newToken) {
            if (oldToken) {
                await this.unregisterTokenHandler(oldToken)
            }
            const ok = await this.registerTokenHandler(newToken)
            if (!ok) {
                throw new Error("Failed to subscribe to push notification")
            }
            localStorage.setItem(`firebase_token_${this.projectName}`, newToken)
        }

        this.token = newToken
        return { permission_granted: true, token: newToken }
    }

    async disableNotification() {
        if (this.token == null) {
            this.token = localStorage.getItem(`firebase_token_${this.projectName}`)
            if (!this.token) return
        }

        try {
            await deleteToken(this.messaging)
        } catch {
            /* best effort */
        }
        try {
            await this.unregisterTokenHandler(this.token)
        } catch {
            /* best effort */
        }

        localStorage.removeItem(`firebase_token_${this.projectName}`)
        this.token = null
    }

    async registerTokenHandler(token) {
        try {
            const response = await fetch(
                "/api/method/excom.excom.api.notification.subscribe",
                {
                    method: "POST",
                    body: JSON.stringify({
                        fcm_token: token,
                        environment: "Web",
                        device_information: navigator.userAgent,
                    }),
                    headers: {
                        "Content-Type": "application/json",
                        "X-Frappe-CSRF-Token": window.csrf_token,
                    },
                }
            )
            const data = await response.json().catch(() => ({}))
            if (!response.ok || data.exc || data.exception) {
                console.error("Excom push subscribe failed", data)
                return false
            }
            return true
        } catch (e) {
            console.error(e)
            return false
        }
    }

    async unregisterTokenHandler(token) {
        try {
            const response = await fetch(
                "/api/method/excom.excom.api.notification.unsubscribe",
                {
                    method: "POST",
                    body: JSON.stringify({ fcm_token: token }),
                    headers: {
                        "Content-Type": "application/json",
                        "X-Frappe-CSRF-Token": window.csrf_token,
                    },
                }
            )
            const data = await response.json().catch(() => ({}))
            if (!response.ok || data.exc || data.exception) {
                console.error("Excom push unsubscribe failed", data)
                return false
            }
            return true
        } catch (e) {
            console.error(e)
            return false
        }
    }
}

export default FrappePushNotification
