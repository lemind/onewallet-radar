import { NextResponse } from "next/server";
import { findCity } from "../../../lib/cities.ts";
import { fetchAll, type FetchAllResult, type RawEvent } from "../../../lib/ldjson.ts";
import { fetchRa } from "../../../lib/ra.ts";
import { SOURCES, urlsFor } from "../../../lib/sources.ts";
import { filterEvents } from "../../../lib/normalize.ts";
import type { RunResult, SourceError, Source } from "../../../types.ts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const cityId = q.get("city") ?? "";
  const from = q.get("from") ?? "";
  const to = q.get("to") ?? "";

  const city = findCity(cityId);
  if (!city) return NextResponse.json({ error: `unknown city: ${cityId}` }, { status: 400 });

  const fromDate = new Date(`${from}T00:00:00+07:00`);
  const toDate = new Date(`${to}T23:59:59+07:00`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return NextResponse.json({ error: "from and to must be YYYY-MM-DD" }, { status: 400 });
  }
  if (toDate < fromDate) return NextResponse.json({ error: "to is before from" }, { status: 400 });

  // A past `from` is clamped to now: nobody is prospecting an event that already happened.
  const now = new Date();
  const lower = fromDate > now ? fromDate : now;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 45_000);

  // RA is a GraphQL call rather than a listing page, so sources are held as
  // thunks; everything downstream sees one uniform result shape.
  const active: { id: Source; run: () => Promise<FetchAllResult> }[] = [
    ...SOURCES.map((s) => ({ id: s.id, urls: urlsFor(s.id, city.id) }))
      .filter((s) => s.urls.length > 0)
      .map((s) => ({ id: s.id, run: () => fetchAll(s.urls, ac.signal) })),
    { id: "ra" as const, run: () => fetchRa(city.id, lower, toDate, ac.signal) },
  ];

  try {
    const settled = await Promise.allSettled(active.map((s) => s.run()));
    const raws: { raw: RawEvent; source: Source }[] = [];
    const errors: SourceError[] = [];

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
        }
      } else {
        const message = r.reason instanceof Error ? r.reason.message : String(r.reason);
        errors.push({ source, message });
        if (source === "meetup") meetupDown = true;
      }
    });

    // Meetup is the only source carrying organizers, so losing it is not a
    // degraded result — it is a different, much worse product pretending to work.
    const allDown = settled.every((r) => r.status === "rejected");
    if (allDown || meetupDown) {
      return NextResponse.json(
        { error: allDown ? "no source could be reached" : "meetup unreachable", events: [], errors },
        { status: 502 },
      );
    }

    const { events, dropped } = filterEvents(raws, {
      now: lower,
      to: toDate,
      centre: { lat: city.lat, lng: city.lng },
    });
    const body: RunResult = {
      city: city.id,
      from,
      to,
      fetchedAt: new Date().toISOString(),
      events,
      dropped,
      errors,
    };
    return NextResponse.json(body);
  } finally {
    clearTimeout(timer);
  }
}
