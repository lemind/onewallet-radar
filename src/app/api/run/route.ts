import { NextResponse } from "next/server";
import { findCity } from "../../../lib/cities.ts";
import { AllDown, MeetupDown, runCity } from "../../../lib/run.ts";

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

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 45_000);
  try {
    return NextResponse.json(await runCity(city.id, from, to, ac.signal));
  } catch (err) {
    if (err instanceof AllDown || err instanceof MeetupDown) {
      return NextResponse.json({ error: err.message, events: [], errors: [] }, { status: 502 });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
