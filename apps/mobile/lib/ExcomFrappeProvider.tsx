/**
 * FrappeProvider wrapper for the Excom mobile app.
 *
 * Mirrors raven/apps/mobile/lib/FrappeNativeProvider.tsx:
 * wraps frappe-react-sdk's FrappeProvider with Bearer token auth
 * (instead of cookie auth used on web) and configures SWR to
 * revalidate on network reconnect and app focus.
 */

import React, { useCallback, useRef, type ReactNode } from "react";
import { AppState, type AppStateStatus } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { FrappeProvider } from "frappe-react-sdk";

import { getAccessToken } from "./auth";
import type { SiteInformation } from "../types/SiteInformation";

interface Props {
  siteInfo: SiteInformation;
  children: ReactNode;
}

export function ExcomFrappeProvider({ siteInfo, children }: Props) {
  const tokenRef = useRef<string | null>(null);

  const getToken = useCallback(async () => {
    const token = await getAccessToken(siteInfo.sitename);
    tokenRef.current = token;
    return token ?? "";
  }, [siteInfo.sitename]);

  const getTokenSync = useCallback(() => {
    return tokenRef.current ?? "";
  }, []);

  return (
    <FrappeProvider
      url={siteInfo.url}
      tokenParams={{
        type: "Bearer" as const,
        useToken: true,
        token: getTokenSync,
      }}
      siteName={siteInfo.sitename}
      swrConfig={{
        provider: () => new Map(),
        initFocus(callback) {
          let appState = AppState.currentState;

          const onAppStateChange = (nextState: AppStateStatus) => {
            if (
              appState.match(/inactive|background/) &&
              nextState === "active"
            ) {
              callback();
            }
            appState = nextState;
          };

          const subscription = AppState.addEventListener(
            "change",
            onAppStateChange
          );

          return () => {
            subscription.remove();
          };
        },
        initReconnect(callback) {
          const unsubscribe = NetInfo.addEventListener((state) => {
            if (state.isConnected) {
              callback();
            }
          });

          return () => {
            unsubscribe();
          };
        },
      }}
    >
      {children}
    </FrappeProvider>
  );
}
