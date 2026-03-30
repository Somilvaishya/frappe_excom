/**
 * Parse a Frappe datetime string into a proper Date object.
 *
 * Frappe stores naive datetimes in the server timezone. JavaScript's
 * `new Date("YYYY-MM-DD HH:mm:ss")` interprets this as the *browser's*
 * local timezone, which is wrong when the user is in a different timezone
 * than the server.
 *
 * This module detects the server timezone from `frappe.boot` and adjusts
 * the parsed Date accordingly so that relative-time displays ("5 min ago")
 * and absolute displays are always correct.
 */

let _serverTzOffset: number | null = null;

function getServerTimezoneOffset(): number {
  if (_serverTzOffset !== null) return _serverTzOffset;

  const tz =
    (window as any).frappe?.boot?.time_zone?.system ||
    (window as any).frappe?.boot?.sysdefaults?.time_zone ||
    Intl.DateTimeFormat().resolvedOptions().timeZone;

  try {
    const now = new Date();
    const serverFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = serverFormatter.formatToParts(now);
    const get = (type: string) =>
      parseInt(parts.find((p) => p.type === type)?.value || "0", 10);

    const serverLocal = new Date(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second"),
    );

    // Difference: what the server considers "now" vs what our browser considers "now"
    _serverTzOffset = serverLocal.getTime() - now.getTime();
  } catch {
    _serverTzOffset = 0;
  }
  return _serverTzOffset;
}

/**
 * Parse a Frappe datetime string ("YYYY-MM-DD HH:mm:ss.ffffff") into a
 * Date that represents the correct absolute point in time, regardless
 * of the browser's timezone.
 */
export function parseFrappeDateTime(dateStr: string | Date): Date {
  if (dateStr instanceof Date) return dateStr;
  if (!dateStr) return new Date();

  // new Date() parses "YYYY-MM-DD HH:mm:ss" as browser-local time.
  // We need to adjust by the difference between server TZ and browser TZ.
  const browserLocal = new Date(dateStr.replace(" ", "T"));
  if (isNaN(browserLocal.getTime())) return new Date();

  const offset = getServerTimezoneOffset();
  if (offset === 0) return browserLocal;

  // browserLocal is the datetime interpreted in the browser TZ.
  // We want the datetime as interpreted in the server TZ.
  // offset = (server "now" local time) - (browser "now" UTC-based time)
  // Adjustment: subtract the offset to shift from browser-local to server-local meaning.
  return new Date(browserLocal.getTime() - offset);
}
