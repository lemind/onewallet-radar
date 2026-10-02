import { findCity } from "./cities.ts";
import { distanceKm } from "./normalize.ts";
import type { CityId } from "../types.ts";
import { claimLookup, recall, remember, storeReady, type Fixed } from "./venue-store.ts";
import { venueKey } from "./venues.ts";

/**
 * Turn an address into a point, at most once per venue ever.
 *
 * Geocoding has a single SKU — 10,000 a month free, then $5 per 1,000 — and
 * unlike the Places call this replaces, no field makes it dearer. The cost
 * control is not the price though, it is that the answer is written down:
 * see venue-store.ts.
 */
const ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json";

/** Nothing is asked without both the key and somewhere to record the answer. */
function enabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY) && storeReady();
}

async function ask(query: string, city: CityId, signal?: AbortSignal): Promise<Fixed | null> {
  const c = findCity(city);
  if (!c) return null;
  // A box around the city, so a street name that exists countrywide resolves here.
  const bounds = `${c.lat - 1},${c.lng - 1}|${c.lat + 1},${c.lng + 1}`;
  const url =
    `${ENDPOINT}?address=${encodeURIComponent(query)}&region=th&bounds=${bounds}` +
    `&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}`;
  const res = await fetch(url, { signal, cache: "no-store" });
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    throw new Error(`geocode returned ${res.status}`);
  }
  const body = (await res.json()) as {
    status: string;
    results?: { geometry?: { location?: { lat: number; lng: number } } }[];
  };
  if (body.status === "ZERO_RESULTS") return null;
  if (body.status !== "OK") throw new Error(`geocode said ${body.status}`);
  const at = body.results?.[0]?.geometry?.location;
  if (!at) return null;
  // A geocoder falls back to the district centre when it cannot find the place
  // and presents it as the venue; outside the city radius it is not our venue.
  return distanceKm(c.lat, c.lng, at.lat, at.lng) <= c.radiusKm ? at : null;
}

/**
 * Resolve the venues a source left unplaced and the file does not hold.
 * Returns only what it learned; the caller already has the file's answers.
 */
export async function locate(
  asks: { venue: string | null; address: string | null }[],
  city: CityId,
  signal?: AbortSignal,
): Promise<Map<string, Fixed>> {
  const out = new Map<string, Fixed>();
  if (!enabled() || asks.length === 0) return out;

  // The same venue hosts several events in one run; ask once.
  const unique = new Map<string, string>();
  for (const a of asks) {
    const key = venueKey(a.venue, a.address);
    if (!key || unique.has(key)) continue;
    unique.set(key, [a.venue, a.address].filter(Boolean).join(", ").slice(0, 300));
  }

  for (const [key, query] of unique) {
    const known = await recall(key, signal);
    if (known.state === "hit") {
      out.set(key, known.at);
      continue;
    }
    if (known.state === "miss") continue; // asked before, not found; do not pay again
    if (signal?.aborted) break;
    // Budget is claimed before the call, so a failure still costs the count.
    if (!(await claimLookup(signal))) break;
    try {
      const at = await ask(query, city, signal);
      await remember(key, at, signal);
      if (at) out.set(key, at);
    } catch {
      // Do not write a miss for a transient failure, or a bad minute would
      // blacklist the venue permanently. Stop, rather than burn the budget.
      break;
    }
  }
  return out;
}
