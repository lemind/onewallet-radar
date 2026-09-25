import type { Event, DroppedCounts, Source } from "../types.ts";
import type { RawEvent } from "./ldjson.ts";
import { parseStart, toLocal } from "./time.ts";

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function first<T>(v: T | T[] | undefined): T | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Pick the entry that actually names a place; a hybrid event can list VirtualLocation first. */
function pickPlace(loc: unknown): unknown {
  const list = Array.isArray(loc) ? loc : [loc];
  const real = list.find(
    (p) =>
      typeof p === "string" ||
      (p && typeof p === "object" && (p as Record<string, unknown>)["@type"] !== "VirtualLocation"),
  );
  return real ?? list[0];
}

function flatAddress(loc: unknown): { venue: string | null; address: string | null } {
  const place = pickPlace(loc);
  // schema.org allows location to be plain text; that text is the address.
  if (typeof place === "string") return { venue: null, address: str(place) };
  if (!place || typeof place !== "object") return { venue: null, address: null };
  const venue = str((place as Record<string, unknown>).name);
  const a = (place as Record<string, unknown>).address;
  if (typeof a === "string") return { venue, address: str(a) };
  if (a && typeof a === "object") {
    const parts = ["streetAddress", "addressLocality", "addressRegion", "postalCode"]
      .map((k) => str((a as Record<string, unknown>)[k]))
      .filter(Boolean);
    return { venue, address: parts.length ? parts.join(", ") : null };
  }
  return { venue, address: null };
}

function isOnline(v: unknown): boolean {
  // schema.org allows a string or an array; the prototype assumed a string and crashed.
  const vals = Array.isArray(v) ? v : [v];
  return vals.some((x) => typeof x === "string" && x.endsWith("OnlineEventAttendanceMode"));
}

export type Normalized = { event: Event; online: boolean; start: Date | null };

export function normalize(raw: RawEvent, source: Source = "meetup"): Normalized {
  const { venue, address } = flatAddress(raw.location);
  const org = first(raw.organizer as Record<string, unknown> | Record<string, unknown>[]);
  const parsed = parseStart(raw.startDate);
  return {
    online: isOnline(raw.eventAttendanceMode),
    start: parsed ? parsed.at : null,
    event: {
      source,
      name: str(raw.name) ?? "",
      url: str(raw.url) ?? "",
      startUtc: parsed ? parsed.at.toISOString() : "",
      startLocal: parsed ? toLocal(parsed.at, parsed.precision) : "",
      startPrecision: parsed ? parsed.precision : "datetime",
      end: str(raw.endDate),
      venue,
      address,
      organizer: org && typeof org === "object" ? str(org.name) : str(raw.organizer),
      organizerUrl: org && typeof org === "object" ? str(org.url) : null,
    },
  };
}

export type FilterResult = { events: Event[]; dropped: DroppedCounts };

/**
 * Apply the five filter rules, dedupe, and sort chronologically.
 * `now` is injected so tests are deterministic against a saved fixture.
 */
export function filterEvents(
  raws: { raw: RawEvent; source: Source }[],
  opts: { now: Date; to: Date },
): FilterResult {
  const dropped: DroppedCounts = { online: 0, noVenue: 0, noDate: 0, outOfRange: 0, duplicate: 0 };
  const seen = new Set<string>();
  const kept: { e: Event; t: number }[] = [];

  for (const { raw, source } of raws) {
    const { event, online, start } = normalize(raw, source);
    if (online) { dropped.online++; continue; }
    // A lead needs somewhere to go: keep anything with a venue name or an address.
    if (!event.venue && !event.address) { dropped.noVenue++; continue; }
    if (!start) { dropped.noDate++; continue; }
    // A date-only event covers its whole day, so compare against its end of day
    // or a same-day listing would be dropped the moment the clock passed midnight.
    const upper = event.startPrecision === "date"
      ? new Date(start.getTime() + 86_400_000 - 1)
      : start;
    if (upper < opts.now || start > opts.to) { dropped.outOfRange++; continue; }
    // Include the raw start and end: date-only sources give every session of a
    // day the same instant, so startUtc alone would collapse distinct sittings.
    const key = [event.source, event.url || event.name, event.startUtc, String(raw.startDate ?? ""), String(raw.endDate ?? "")].join("|");
    if (seen.has(key)) { dropped.duplicate++; continue; }
    seen.add(key);
    kept.push({ e: event, t: start.getTime() });
  }

  // Sort on the instant, not the ISO string — string order breaks across offsets.
  kept.sort((a, b) => a.t - b.t);
  return { events: kept.map((k) => k.e), dropped };
}
