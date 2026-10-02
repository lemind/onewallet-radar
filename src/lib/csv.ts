import type { Event } from "../types.ts";

export const COLUMNS = [
  "name",
  "start_local",
  "organizer",
  "organizer_url",
  "venue",
  "address",
  "source",
  "url",
] as const;

function cell(v: string | null): string {
  if (!v) return "";
  // Excel reads a leading = + - @ as a formula, so "+66 2 656 1000" renders as
  // #NAME? instead of the number someone needs to dial. A tab stops that.
  const safe = /^[=+\-@\t\r]/.test(v) ? `\t${v}` : v;
  return /[",\r\n\t]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function row(e: Event): string {
  return [
    e.name,
    e.startLocal,
    e.organizer,
    e.organizerUrl,
    e.venue,
    e.address,
    e.source,
    e.url,
  ]
    .map(cell)
    .join(",");
}

/**
 * CSV for Excel: BOM first or Thai venue names arrive as mojibake, CRLF line endings.
 * Browser-safe on purpose — the page builds this from state, with no second scrape.
 */
export function toCsv(events: Event[]): string {
  const lines = [COLUMNS.join(","), ...events.map(row)];
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export function filename(city: string, from: string): string {
  return `onewallet-${city}-${from}.csv`;
}
