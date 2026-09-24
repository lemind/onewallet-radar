import { NextResponse } from "next/server";
import { findCity } from "../../../lib/cities.ts";
import { fetchAll, type RawEvent } from "../../../lib/ldjson.ts";
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

  const active = SOURCES.map((s) => ({ id: s.id, urls: urlsFor(s.id, city.id) })).filter(
    (s) => s.urls.length > 0,
  );

  try {
    const settled = await Promise.allSettled(active.map((s) => fetchAll(s.urls, ac.signal)));
    const raws: { raw: RawEvent; source: Source }[] = [];
    const errors: SourceError[] = [];

    settled.forEach((r, i) => {
      const source = active[i].id;
      if (r.status === "fulfilled") {
        for (const raw of r.value) raws.push({ raw, source });
      } else {
        const message = r.reason instanceof Error ? r.reason.message : String(r.reason);
        errors.push({ source, message });
      }
    });

    // Only a total failure is fatal — there is nothing truthful to return.
    if (errors.length === active.length) {
      return NextResponse.json(
        { error: "no source could be reached", events: [], errors },
        { status: 502 },
      );
    }

    const { events, dropped } = filterEvents(raws, { now: lower, to: toDate });
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
