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

/**
 * Parse a published startDate. Returns null when unparseable.
 * A value with no offset is read as Bangkok local, not UTC — see SPEC.md 7.1.
 */
export function parseStart(raw: unknown): Date | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const s = raw.trim();
  const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(s);
  const d = new Date(hasOffset ? s : `${s}+07:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Render an instant in Asia/Bangkok. Raw UTC must never reach a user. */
export function toLocal(d: Date): string {
  return FMT.format(d);
}
