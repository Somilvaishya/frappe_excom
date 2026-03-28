/**
 * Site metadata stored on the device for multi-site support.
 * Mirrors raven/apps/mobile/types/SiteInformation.ts.
 */

export interface SiteInformation {
  /** Full URL of the Frappe site, e.g. "https://erp.example.com" */
  url: string;

  /** The Frappe site name used for Socket.IO connections */
  sitename: string;

  /** OAuth Client name stored on Excom Settings */
  client_id: string;

  /** Display name (from Website Settings or "Excom") */
  app_name: string;

  /** System timezone, e.g. "Asia/Kolkata" */
  system_timezone: string;

  /** App logo URL */
  logo: string;

  /** Excom version string */
  excom_version: string;

  /** Frappe version string */
  frappe_version: string;
}
