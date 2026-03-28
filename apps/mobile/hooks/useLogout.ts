/**
 * Logout hook for the Excom mobile app.
 *
 * Mirrors raven/apps/mobile/hooks/useLogout.ts:
 * 1. Unsubscribes the FCM token from the backend.
 * 2. Revokes the OAuth token on the server.
 * 3. Clears local token storage.
 * 4. Navigates back to the landing page.
 */

import { useCallback } from "react";
import { useRouter } from "expo-router";
import { revokeAsync } from "expo-auth-session";
import messaging from "@react-native-firebase/messaging";
import { useFrappePostCall } from "frappe-react-sdk";

import {
  clearDefaultSite,
  deleteAccessToken,
  discovery,
  getAccessToken,
} from "../lib/auth";

import type { SiteInformation } from "../types/SiteInformation";

export function useLogout(siteInfo: SiteInformation | null) {
  const router = useRouter();
  const { call: unsubscribePush } = useFrappePostCall(
    "excom.excom.api.notification.unsubscribe"
  );

  const logout = useCallback(async () => {
    if (!siteInfo) return;

    // 1. Unregister FCM token from the Excom backend
    try {
      const fcmToken = await messaging().getToken();
      if (fcmToken) {
        await unsubscribePush({ fcm_token: fcmToken });
      }
    } catch {
      // Best effort -- continue with logout
    }

    // 2. Revoke the OAuth token on the server
    try {
      const accessToken = await getAccessToken(siteInfo.sitename);
      if (accessToken) {
        await revokeAsync(
          { token: accessToken },
          {
            revocationEndpoint: `${siteInfo.url}${discovery.revocationEndpoint}`,
          }
        );
      }
    } catch {
      // Best effort
    }

    // 3. Clear local storage
    await deleteAccessToken(siteInfo.sitename);
    await clearDefaultSite();

    // 4. Navigate to landing
    router.replace("/landing");
  }, [siteInfo, unsubscribePush, router]);

  return { logout };
}
