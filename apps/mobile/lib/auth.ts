/**
 * Authentication helpers for the Excom mobile app.
 *
 * Mirrors raven/apps/mobile/lib/auth.ts:
 * - OAuth2 PKCE discovery endpoints (Frappe core)
 * - Access/refresh token storage via expo-secure-store
 * - Multi-site metadata via AsyncStorage
 * - Default site management
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

import type { SiteInformation } from "../types/SiteInformation";

// ── Keys ─────────────────────────────────────────────────────────

const getAccessTokenKey = (siteName: string) => `${siteName}-access-token`;
const getRefreshTokenKey = (siteName: string) => `${siteName}-refresh-token`;

export const SITES_KEY = "excom-sites";
export const DEFAULT_SITE_KEY = "excom-default-site";

// ── OAuth2 Discovery (Frappe core endpoints) ────────────────────

export const discovery = {
  authorizationEndpoint:
    "/api/method/frappe.integrations.oauth2.authorize",
  tokenEndpoint: "/api/method/frappe.integrations.oauth2.get_token",
  revocationEndpoint:
    "/api/method/frappe.integrations.oauth2.revoke_token",
};

// ── Token CRUD (SecureStore) ────────────────────────────────────

export async function getAccessToken(
  siteName: string
): Promise<string | null> {
  return SecureStore.getItemAsync(getAccessTokenKey(siteName));
}

export async function setAccessToken(
  siteName: string,
  token: string
): Promise<void> {
  await SecureStore.setItemAsync(getAccessTokenKey(siteName), token);
}

export async function deleteAccessToken(
  siteName: string
): Promise<void> {
  await SecureStore.deleteItemAsync(getAccessTokenKey(siteName));
}

export async function getRefreshToken(
  siteName: string
): Promise<string | null> {
  return SecureStore.getItemAsync(getRefreshTokenKey(siteName));
}

export async function setRefreshToken(
  siteName: string,
  token: string
): Promise<void> {
  await SecureStore.setItemAsync(getRefreshTokenKey(siteName), token);
}

export async function deleteRefreshToken(
  siteName: string
): Promise<void> {
  await SecureStore.deleteItemAsync(getRefreshTokenKey(siteName));
}

// ── Site Metadata (AsyncStorage) ────────────────────────────────

export async function getSitesFromStorage(): Promise<
  Record<string, SiteInformation>
> {
  const raw = await AsyncStorage.getItem(SITES_KEY);
  return JSON.parse(raw || "{}");
}

export async function getSiteFromStorage(
  siteName: string
): Promise<SiteInformation | null> {
  const sites = await getSitesFromStorage();
  return sites[siteName] || null;
}

export async function addSiteToStorage(
  siteName: string,
  siteInfo: SiteInformation
): Promise<void> {
  await AsyncStorage.mergeItem(
    SITES_KEY,
    JSON.stringify({ [siteName]: siteInfo })
  );
}

export async function removeSiteFromStorage(
  siteName: string
): Promise<void> {
  const sites = await getSitesFromStorage();
  delete sites[siteName];
  await AsyncStorage.setItem(SITES_KEY, JSON.stringify(sites));
}

// ── Default Site ────────────────────────────────────────────────

export async function setDefaultSite(siteName: string): Promise<void> {
  await AsyncStorage.setItem(DEFAULT_SITE_KEY, siteName);
}

export async function clearDefaultSite(): Promise<void> {
  await AsyncStorage.removeItem(DEFAULT_SITE_KEY);
}

export async function getDefaultSite(): Promise<string | null> {
  return AsyncStorage.getItem(DEFAULT_SITE_KEY);
}
