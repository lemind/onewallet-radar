import { NextResponse } from "next/server";
import { findCity } from "../../../lib/cities.ts";
import { fetchListing, extractEvents } from "../../../lib/meetup.ts";
import { filterEvents } from "../../../lib/normalize.ts";
import type { RunResult } from "../../../types.ts";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const cityId = q.get("city") ?? "";
  const from = q.get("from") ?? "";
  const to = q.get("to") ?? "";

  const city = findCity(cityId);
  if (!city) return NextResponse.json({ error: `unknown city: ${cityId}` }, { status: 400 });

  const toDate = new Date(`${to}T23:59:59+07:00`);
  const fromDate = new Date(`${from}T00:00:00+07:00`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return NextResponse.json({ error: "from and to must be YYYY-MM-DD" }, { status: 400 });
  }
  if (toDate < fromDate) {
    return NextResponse.json({ error: "to is before from" }, { status: 400 });
  }

  // A past `from` is clamped to now: nobody is prospecting an event that already happened.
  const now = new Date();
  const lower = fromDate > now ? fromDate : now;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 25_000);
  try {
    const html = await fetchListing(city.meetupSlug, ac.signal);
    const { events, dropped } = filterEvents(extractEvents(html), { now: lower, to: toDate });
    const body: RunResult = {
      city: city.id,
      from,
      to,
      fetchedAt: new Date().toISOString(),
      events,
      dropped,
      errors: [],
    };
    return NextResponse.json(body);
  } catch (err) {
    // Meetup unreachable is the one case that fails the run — nothing truthful to return.
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "meetup unreachable", events: [], errors: [{ source: "meetup", message }] },
      { status: 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
