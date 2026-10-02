import { findCity } from "./cities.ts";
import { distanceKm } from "./normalize.ts";
import type { CityId } from "../types.ts";
import { claimLookup, recall, remember, storeReady, type Fixed } from "./venue-store.ts";
import { queryFor, venueKey, worthAsking } from "./venues.ts";

/**
 * Turn an address into a point, at most once per venue ever.
 *
 * Geocoding has a single SKU — 10,000 a month free, then $5 per 1,000 — and
 * unlike the Places call this replaces, no field makes it dearer. The cost
 * control is not the price though, it is that the answer is written down:
 * see venue-store.ts.
 */
const ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json";

/** Result types that describe an area rather than a place. None of these is a venue. */
const ADMIN = new Set([
  "locality", "sublocality", "political", "country", "postal_code",
  "administrative_area_level_1", "administrative_area_level_2",
  "administrative_area_level_3", "administrative_area_level_4",
]);

/**
 * A server-only key, never NEXT_PUBLIC_. The map key is inlined into the browser
 * bundle, so anyone could read it and bill geocoding to the card with nothing
 * here counting it. Restrict this one to the Geocoding API in the console.
 */
function apiKey(): string | undefined {
  return process.env.GOOGLE_GEOCODING_KEY;
}

/** Nothing is asked without both the key and somewhere to record the answer. */
function enabled(): boolean {
  return Boolean(apiKey()) && storeReady();
}

async function ask(query: string, city: CityId, signal?: AbortSignal): Promise<Fixed | null> {
  const c = findCity(city);
  if (!c) return null;
  // A box around the city, so a street name that exists countrywide resolves here.
  const bounds = `${c.lat - 1},${c.lng - 1}|${c.lat + 1},${c.lng + 1}`;
  const url =
    `${ENDPOINT}?address=${encodeURIComponent(query)}&region=th&bounds=${bounds}` +
    `&key=${apiKey()}`;
  const res = await fetch(url, { signal, cache: "no-store" });
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    throw new Error(`geocode returned ${res.status}`);
  }
  const body = (await res.json()) as {
    status: string;
    results?: {
      types?: string[];
      partial_match?: boolean;
      geometry?: { location?: { lat: number; lng: number } };
    }[];
  };
  if (body.status === "ZERO_RESULTS") return null;
  if (body.status !== "OK") throw new Error(`geocode said ${body.status}`);
  const top = body.results?.[0];
  const at = top?.geometry?.location;
  if (!at) return null;
  // The answer has to be a place, not a city. Geocoding always answers, and an
  // unfindable venue comes back as the locality or district it sits in, which
  // the radius check passes happily because it is the centre of the city.
  if (top?.partial_match) return null;
  if (top?.types?.some((t) => ADMIN.has(t))) return null;
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
    // Nothing distinctive to ask about: the geocoder would answer with the city.
    if (!worthAsking(a.venue, a.address)) continue;
    unique.set(key, queryFor(a.venue, a.address));
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
