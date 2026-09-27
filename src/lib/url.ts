/**
 * An href we are willing to emit for a scraped URL. Every link on a city page
 * comes from a third-party listing, so a "javascript:" or "data:" value must
 * never reach an anchor. Returns null when the URL is missing or not http(s).
 */
export function httpUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  try {
    const p = new URL(u);
    return p.protocol === "http:" || p.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}
