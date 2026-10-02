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

/**
 * One key for the map and for Places, by choice. It is NEXT_PUBLIC because the
 * map needs it in the browser, so it is visible in the bundle either way;
 * restrict it by origin in the Google console rather than by hiding it.
 */
function apiKey(): string | undefined {
  // OFF by default. Paid lookups ran on every page rebuild and every search and
  // cost real money; set PLACES_ENABLED=1 to turn them back on deliberately.
  if (process.env.PLACES_ENABLED !== "1") return undefined;
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
}

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

/**
 * Hard ceiling on lookups in one run, so a loop cannot spend the month.
 * Set above the largest city's venue count (Bangkok, ~130) on purpose: a lower
 * cap would leave the same venues permanently unplaceable, because there is no
 * way to tell a free cached hit from a paid miss before making the call.
 * Worst case here is a one-off of roughly 150 calls; every later run is cached.
 */
const MAX_LOOKUPS_PER_RUN = 150;

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

/**
 * Words that identify nothing. Placeholders, and the city and country names
 * that appear in every address — without those, "TBA, Bangkok" would match
 * "TBA Rooftop Bar Bangkok" on the word Bangkok alone.
 */
const GENERIC = new Set([
  "tba", "tbc", "tbd", "online", "venue", "secret", "location", "announced",
  "bangkok", "chiang", "mai", "phuket", "thailand", "krung", "thep", "nakhon",
  "district", "amphur", "amphoe", "tambon", "khet", "khwaeng", "road", "rd",
  "soi", "alley", "lane", "moo", "the", "and",
]);

/**
 * Does the place Places returned plausibly answer what we asked?
 *
 * Text Search always returns its best guess, so "TBA, Bangkok" comes back as
 * "TBA Rooftop Bar Bangkok" with a real phone number. Writing that into the
 * partner sheet is the SPEC.md 9.9 failure — a wrong phone is worse than none.
 * Require a real word in common between the venue asked for and the name
 * returned.
 */
export function matches(venue: string | null, returned: string | null): boolean {
  if (!venue || !returned) return false;
  const words = (t: string) =>
    new Set(
      t
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .split(" ")
        .filter((w) => w.length > 2 && !GENERIC.has(w) && !/^\d+$/.test(w)),
    );
  const asked = words(venue);
  if (asked.size === 0) return false; // nothing distinctive was asked for
  const got = words(returned);
  for (const w of asked) if (got.has(w)) return true;
  return false;
}

type SearchResponse = {
  places?: {
    displayName?: { text?: string };
    location?: { latitude?: number; longitude?: number };
    nationalPhoneNumber?: string;
    websiteUri?: string;
  }[];
};

async function search(query: string, city: CityId): Promise<Place | null> {
  const key = apiKey();
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
  if (!apiKey()) return out;
  // The same venue often hosts several events in one run; ask once.
  const unique = [...new Set(queries.filter((q) => q.trim() !== ""))];
  const found = await Promise.all(
    unique.slice(0, MAX_LOOKUPS_PER_RUN).map(async (q) => {
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

/**
 * Cache key for a query. Sources spell one venue several ways — "Hemingway"
 * and "Hemingway, 159 Sukhumvit 55" are the same bar — and each spelling was
 * being bought separately. Measured 28 Sep: 76 paid lookups, 36 real venues.
 */
export function cacheKeyFor(venue: string | null, address: string | null): string {
  const base = (venue || address || "").toLowerCase();
  return base
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .slice(0, 80);
}
