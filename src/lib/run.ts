import { findCity } from "./cities.ts";
import { fetchAll, type FetchAllResult, type RawEvent } from "./ldjson.ts";
import { fetchRa } from "./ra.ts";
import { SOURCES, urlsFor } from "./sources.ts";
import { filterEvents } from "./normalize.ts";
import type { CityId, RunResult, Source, SourceError } from "../types.ts";

/** Fatal for a run. Carries the per-source errors, which are the whole diagnostic. */
export class RunFailed extends Error {
  constructor(
    message: string,
    readonly errors: SourceError[],
  ) {
    super(message);
  }
}
export class MeetupDown extends RunFailed {}
export class AllDown extends RunFailed {}

/**
 * Scrape one city over one window. Shared by the API route and the city pages
 * so both see the same leads, filters and error handling.
 */
export async function runCity(
  cityId: CityId,
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<RunResult> {
  const city = findCity(cityId);
  if (!city) throw new Error(`unknown city: ${cityId}`);

  const fromDate = new Date(`${from}T00:00:00+07:00`);
  const toDate = new Date(`${to}T23:59:59+07:00`);
  // Validated here as well as in the route: an unchecked window silently
  // becomes an Invalid Date and every comparison against it quietly fails.
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    throw new RangeError("from and to must be YYYY-MM-DD");
  }
  if (toDate < fromDate) throw new RangeError("to is before from");
  const now = new Date();
  const lower = fromDate > now ? fromDate : now;

  // RA is a GraphQL call rather than a listing page, so sources are held as
  // thunks; everything downstream sees one uniform result shape.
  const active: { id: Source; run: () => Promise<FetchAllResult> }[] = [
    ...SOURCES.map((s) => ({ id: s.id, urls: urlsFor(s.id, city.id) }))
      .filter((s) => s.urls.length > 0)
      .map((s) => ({ id: s.id, run: () => fetchAll(s.urls, signal) })),
    { id: "ra" as const, run: () => fetchRa(city.id, lower, toDate, signal) },
  ];

  const settled = await Promise.allSettled(active.map((s) => s.run()));
  const raws: { raw: RawEvent; source: Source }[] = [];
  const errors: SourceError[] = [];
  const notices: SourceError[] = [];
  let meetupDown = false;

  settled.forEach((r, i) => {
    const source = active[i].id;
    if (r.status === "fulfilled") {
      for (const raw of r.value.events) raws.push({ raw, source });
      // A source that answered on some of its pages returned a truncated list.
      // Saying so is the difference between a short week and a broken scrape.
      if (r.value.failed > 0) {
        errors.push({
          source,
          message: `${r.value.failed} of ${r.value.total} listing pages failed (${r.value.reason})`,
        });
      } else if (r.value.note) {
        notices.push({ source, message: r.value.note });
      }
    } else {
      errors.push({ source, message: r.reason instanceof Error ? r.reason.message : String(r.reason) });
      if (source === "meetup") meetupDown = true;
    }
  });

  // Meetup is the only source carrying organizers, so losing it is not a
  // degraded result — it is a different, much worse product pretending to work.
  if (settled.every((r) => r.status === "rejected")) {
    throw new AllDown("no source could be reached", errors);
  }
  if (meetupDown) throw new MeetupDown("meetup unreachable", errors);

  const { events, dropped } = filterEvents(raws, {
    now: lower,
    to: toDate,
    centre: { lat: city.lat, lng: city.lng, radiusKm: city.radiusKm },
  });
  return {
    city: city.id,
    from,
    to,
    fetchedAt: new Date().toISOString(),
    events,
    dropped,
    errors,
    notices,
  };
}
