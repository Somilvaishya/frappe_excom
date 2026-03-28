/**
 * Hook to register FCM push tokens with the Excom backend.
 *
 * Mirrors raven/apps/mobile/hooks/useFirebasePushTokenListener.ts:
 * requests notification permission, retrieves the FCM device token,
 * and POSTs it to excom.excom.api.notification.subscribe.
 */

import { useEffect, useRef } from "react";
import { useFrappePostCall } from "frappe-react-sdk";
import messaging from "@react-native-firebase/messaging";
import * as Device from "expo-device";

import type { SiteInformation } from "../types/SiteInformation";

export function useFirebasePushToken(siteInfo: SiteInformation | null) {
  const callMade = useRef(false);
  const { call } = useFrappePostCall(
    "excom.excom.api.notification.subscribe"
  );

  useEffect(() => {
    if (!siteInfo || callMade.current) return;

    const register = async () => {
      try {
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (!enabled) return;

        const fcmToken = await messaging().getToken();
        if (!fcmToken) return;

        await call({
          fcm_token: fcmToken,
          environment: "Mobile",
          device_information: Device.deviceName ?? undefined,
        });

        callMade.current = true;
      } catch {
        // Silently fail -- push is best-effort
      }
    };

    register();
  }, [siteInfo, call]);
}
