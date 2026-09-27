/**
 * When an event falls, and the colour that says so. Shared by the map pins and
 * the table so the two can never disagree about what green means.
 *
 * There is no colour for "already happened": filterEvents drops those before
 * anything renders.
 */
export const TODAY = "#1a8f4c";
export const LATER = "#2563eb";

/** Today in Asia/Bangkok, as the YYYY-MM-DD that startLocal already begins with. */
export function bangkokToday(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bangkok" }).format(new Date());
}

/** startLocal is "YYYY-MM-DD HH:MM" or bare "YYYY-MM-DD"; the date prefix suits both. */
export function isToday(startLocal: string, today = bangkokToday()): boolean {
  return startLocal.startsWith(today);
}
