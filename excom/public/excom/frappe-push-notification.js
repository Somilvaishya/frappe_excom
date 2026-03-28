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

class FrappePushNotification {
    static get relayServerBaseURL() {
        return window.frappe?.boot.push_relay_server_url
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

    async fetchWebConfig() {
        if (this.webConfig != null) return this.webConfig

        try {
            if (window.frappe?.boot.push_notification_service === "Excom Cloud") {
                this.webConfig = JSON.parse(window.frappe?.boot.firebase_client_config)
                return this.webConfig
            }
            const url = `${FrappePushNotification.relayServerBaseURL}/api/method/notification_relay.api.get_config?project_name=${this.projectName}`
            const response = await fetch(url)
            const json = await response.json()
            this.webConfig = json.config
            return this.webConfig
        } catch {
            throw new Error("Push Notification Relay is not configured properly on your site.")
        }
    }

    async fetchVapidPublicKey() {
        if (this.vapidPublicKey !== "") return this.vapidPublicKey

        try {
            if (window.frappe?.boot.push_notification_service === "Excom Cloud") {
                this.vapidPublicKey = window.frappe?.boot.vapid_public_key
                return this.vapidPublicKey
            }
            const url = `${FrappePushNotification.relayServerBaseURL}/api/method/notification_relay.api.get_config?project_name=${this.projectName}`
            const response = await fetch(url)
            const json = await response.json()
            this.vapidPublicKey = json.vapid_public_key
            return this.vapidPublicKey
        } catch {
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
        const newToken = await getToken(this.messaging, {
            vapidKey,
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

        try { await deleteToken(this.messaging) } catch { /* best effort */ }
        try { await this.unregisterTokenHandler(this.token) } catch { /* best effort */ }

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
            return response.status === 200
        } catch {
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
            return response.status === 200
        } catch {
            return false
        }
    }
}

export default FrappePushNotification
