import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching"
import { clientsClaim } from "workbox-core"

import { initializeApp } from "firebase/app"
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw"

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

const jsonConfig = new URL(location).searchParams.get("config")

try {
    if (jsonConfig) {
        const firebaseApp = initializeApp(JSON.parse(jsonConfig))
        const messaging = getMessaging(firebaseApp)

        onBackgroundMessage(messaging, (payload) => {
            const title = payload.notification?.title || "New message"
            const options = {
                body: payload.notification?.body || "",
                icon: "/assets/excom/excom/manifest/android-chrome-192x192.png",
                tag: payload.data?.thread_id || "excom",
                data: {
                    url: payload.data?.base_url
                        ? `${payload.data.base_url}/excom`
                        : "/excom",
                },
            }

            if (payload.data?.image) {
                options.icon = payload.data.image
            }

            self.registration.showNotification(title, options)
        })
    }
} catch (error) {
    console.log("Firebase init skipped or failed", error)
}

self.addEventListener("notificationclick", (event) => {
    event.notification.close()
    const url = event.notification.data?.url || "/excom"
    event.waitUntil(clients.openWindow(url))
})

self.skipWaiting()
clientsClaim()
