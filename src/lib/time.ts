export const TZ = "Asia/Bangkok";

// sv-SE formats as "YYYY-MM-DD HH:MM", which is what we want in the sheet anyway.
const FMT = new Intl.DateTimeFormat("sv-SE", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export type Parsed = { at: Date; precision: "date" | "datetime" };

/**
 * Parse a published startDate. Returns null when unparseable.
 * A bare date ("2026-09-27") is Bangkok midnight but flagged precision "date",
 * so nothing downstream shows a time the source never published.
 * A value with no offset is read as Bangkok local, not UTC — see SPEC.md 7.1.
 */
export function parseStart(raw: unknown): Parsed | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00+07:00`);
    return Number.isNaN(d.getTime()) ? null : { at: d, precision: "date" };
  }
  const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(s);
  const d = new Date(hasOffset ? s : `${s}+07:00`);
  return Number.isNaN(d.getTime()) ? null : { at: d, precision: "datetime" };
}

/** Render in Asia/Bangkok. Raw UTC must never reach a user. */
export function toLocal(d: Date, precision: "date" | "datetime" = "datetime"): string {
  const full = FMT.format(d);
  return precision === "date" ? full.slice(0, 10) : full;
}
