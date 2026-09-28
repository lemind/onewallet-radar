import { unstable_cache } from "next/cache";
import type { CityId } from "../types.ts";
import { findCity } from "./cities.ts";

/**
 * Google Places lookup for events whose source publishes an address but no
 * coordinates — Meetup never does, and RA's are rounded to whole degrees.
 *
 * Measured 28 Sep over 84 unplaced leads: Places located 84, MapTiler 48 with
 * 29 wrong. Places returns real businesses; address geocoders fall back to a
 * district centroid and present it as the venue. See SPEC.md 9.4.
 */
const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

// location fixes the pin; the phone and site are the partner contact the
// spreadsheet is actually for. Asking for fewer fields would be cheaper.
const FIELDS =
  "places.displayName,places.location,places.nationalPhoneNumber,places.websiteUri";

/**
 * A lookup costs money, so the result is cached for 30 days: a venue does not
 * move. Without this the hourly page rebuild would re-ask for every venue,
 * about 60,000 calls a month against a 10,000 free tier.
 */
const CACHE_DAYS = 30;

/** A runaway loop must not be able to spend the month's quota in one request. */
const MAX_PER_RUN = 40;

// Google rejects a bias radius over 50km outright, and Chiang Mai's is 75.
// It only nudges the ranking — the real check is the distance test in run.ts.
const MAX_BIAS_M = 50_000;

export type Place = {
  lat: number;
  lng: number;
  name: string | null;
  phone: string | null;
  website: string | null;
};

type SearchResponse = {
  places?: {
    displayName?: { text?: string };
    location?: { latitude?: number; longitude?: number };
    nationalPhoneNumber?: string;
    websiteUri?: string;
  }[];
};

async function search(query: string, city: CityId): Promise<Place | null> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  if (!key) return null;
  const c = findCity(city);
  if (!c) return null;

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": FIELDS,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      textQuery: query,
      regionCode: "TH",
      maxResultCount: 1,
      // Bias to the city so a venue name that exists in several places resolves here.
      locationBias: {
        circle: {
          center: { latitude: c.lat, longitude: c.lng },
          radius: Math.min(c.radiusKm * 1000, MAX_BIAS_M),
        },
      },
    }),
  });
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    // Throw rather than return null: unstable_cache stores whatever comes back,
    // so a returned null would pin a transient failure in place for 30 days.
    throw new Error(`places returned ${res.status}`);
  }
  const body = (await res.json()) as SearchResponse;
  const p = body.places?.[0];
  const lat = p?.location?.latitude;
  const lng = p?.location?.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return {
    lat,
    lng,
    name: p?.displayName?.text ?? null,
    phone: p?.nationalPhoneNumber ?? null,
    website: p?.websiteUri ?? null,
  };
}

// v2: the first key cached nulls from a bad request and had to be retired.
const cached = unstable_cache(
  (query: string, city: CityId) => search(query, city),
  ["places-text-search-v2"],
  { revalidate: CACHE_DAYS * 86_400 },
);

/**
 * Resolve many queries, de-duplicated and capped. Returns a map keyed by the
 * query string; a query that could not be resolved is simply absent.
 */
export async function lookup(
  queries: string[],
  city: CityId,
): Promise<Map<string, Place>> {
  const out = new Map<string, Place>();
  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY) return out;
  // The same venue often hosts several events in one run; ask once.
  const unique = [...new Set(queries.filter((q) => q.trim() !== ""))].slice(0, MAX_PER_RUN);
  const found = await Promise.all(
    unique.map(async (q) => {
      try {
        return [q, await cached(q, city)] as const;
      } catch {
        return [q, null] as const; // a lookup failing is a missing pin, not a failed run
      }
    }),
  );
  for (const [q, p] of found) if (p) out.set(q, p);
  return out;
}

/** What we ask Places: the venue leads, the address disambiguates. */
export function queryFor(venue: string | null, address: string | null): string {
  return [venue, address]
    .filter(Boolean)
    .join(", ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}
