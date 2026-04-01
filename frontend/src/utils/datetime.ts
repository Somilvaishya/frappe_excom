/**
 * Timezone-aware datetime utilities for Excom.
 *
 * Frappe stores naive datetimes in the server's system timezone (e.g. Asia/Kolkata).
 * JavaScript's Date is always UTC internally. This module:
 *   1. Converts Frappe datetime strings → correct absolute Date objects
 *   2. Provides formatting helpers that display in the SERVER timezone,
 *      so times always match the business context regardless of browser TZ.
 */

let _serverTz: string | null = null;

/**
 * Returns the IANA timezone string for the Frappe server
 * (e.g. "Asia/Kolkata"). Falls back to browser timezone.
 */
export function getServerTimezone(): string {
  if (_serverTz) return _serverTz;

  // Prefer the explicit global set in excom.html / main.tsx
  _serverTz = (window as any).__excom_server_tz || null;

  if (!_serverTz) {
    const boot = (window as any).frappe?.boot;
    if (boot && typeof boot === "object") {
      _serverTz =
        boot.time_zone?.system ||
        boot.sysdefaults?.time_zone ||
        null;
    }
    if (!_serverTz && typeof boot === "string") {
      try {
        const parsed = JSON.parse(boot);
        _serverTz = parsed?.time_zone?.system || parsed?.sysdefaults?.time_zone || null;
      } catch { /* ignore */ }
    }
  }

  if (!_serverTz) {
    _serverTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  return _serverTz;
}

/**
 * Convert a Unix-epoch offset between the server TZ and UTC for a given
 * point-in-time (handles DST-observing zones correctly).
 */
function serverTzOffsetMs(utcMs: number): number {
  const tz = getServerTimezone();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(utcMs));
  const p = (t: string) =>
    parseInt(parts.find((x) => x.type === t)?.value || "0", 10);

  const h = p("hour") === 24 ? 0 : p("hour");
  const rendered = Date.UTC(p("year"), p("month") - 1, p("day"), h, p("minute"), p("second"));
  return rendered - utcMs;
}

/**
 * Parse a Frappe naive datetime string (in server TZ) into a Date that
 * represents the correct absolute point in time.
 */
export function parseFrappeDateTime(dateStr: string | Date): Date {
  if (dateStr instanceof Date) return dateStr;
  if (!dateStr) return new Date();

  const match = dateStr.match(
    /(\d{4})-(\d{2})-(\d{2})[\sT](\d{2}):(\d{2}):(\d{2})/
  );
  if (!match) return new Date();

  const [, y, mo, d, h, mi, s] = match.map(Number);

  // Treat the components as-if UTC, then subtract the server-TZ offset
  // to arrive at the actual UTC epoch.
  const asUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  const offset = serverTzOffsetMs(asUtc);
  return new Date(asUtc - offset);
}

// ── Display helpers (always format in server timezone) ──────────────

const timeCache = new Map<string, Intl.DateTimeFormat>();

function cachedFormatter(key: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  let fmt = timeCache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", { ...opts, timeZone: getServerTimezone() });
    timeCache.set(key, fmt);
  }
  return fmt;
}

/** "2:00 AM" — time only, in server timezone */
export function formatServerTime(date: Date): string {
  return cachedFormatter("time", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/** "Wednesday, April 2, 2026 • 2:00 AM" — full timestamp divider */
export function formatServerDateTimeFull(date: Date): string {
  const datePart = cachedFormatter("dateFull", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
  const timePart = formatServerTime(date);
  return `${datePart} \u2022 ${timePart}`;
}

/** "Apr 2, 2:00 AM" — short date + time */
export function formatServerShortDateTime(date: Date): string {
  return cachedFormatter("shortDT", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/** "Last seen 2:00 AM" */
export function formatServerLastSeen(date: Date): string {
  return `Last seen ${formatServerTime(date)}`;
}
