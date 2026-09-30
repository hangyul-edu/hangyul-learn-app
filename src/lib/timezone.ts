/**
 * The device's timezone and calendar day.
 *
 * Every daily boundary in the app (attendance, streak, daily goals, the daily
 * question set, allowances, reminders, quiet hours) follows the member's local
 * midnight in this zone. The server counts the days; the app keeps it told
 * which zone the device is in (see `lib/timezoneSync.ts`) and shows dates in
 * the same zone.
 */

/** The device's IANA timezone, e.g. `Asia/Seoul`; `UTC` if it cannot be read. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** `YYYY-MM-DD` of `at` on the calendar of `timeZone` (the device's by default). */
export function localDay(at: Date = new Date(), timeZone: string = deviceTimeZone()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}
