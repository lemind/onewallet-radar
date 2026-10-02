import { VENUES } from "../data/venues.ts";

/**
 * Venue coordinates, read from a file in the repository. Nothing here touches
 * the network: a geocoding call that runs on a page rebuild bills on every
 * rebuild, and the 30-day cache it relied on does not survive a deploy.
 * Measured 2 Oct: that mistake cost $40. Fill the file with `npm run geocode`.
 */
export type Fixed = { lat: number; lng: number };

/** "miss" is a venue we asked about and could not place; asking again only costs money. */
export type Known = { state: "hit"; at: Fixed } | { state: "miss" } | { state: "unknown" };

/**
 * One key per real place. Sources spell a venue several ways — "Hemingway" and
 * "Hemingway, 159 Sukhumvit 55" are the same bar — so the name leads and the
 * address only fills in when there is no name.
 */
export function venueKey(venue: string | null, address: string | null): string {
  return (venue || address || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .slice(0, 80);
}

/**
 * What the file knows. A recorded miss must stay distinct from a venue nobody
 * has asked about: collapsing them to null sent every curated miss back to a
 * paid lookup, which then returned a city centroid and overwrote the record.
 * Measured 2 Oct: three junk pins in the store within a handful of searches.
 */
export function fromFile(venue: string | null, address: string | null): Known {
  const key = venueKey(venue, address);
  if (!(key in VENUES)) return { state: "unknown" };
  const hit = VENUES[key];
  return hit ? { state: "hit", at: hit } : { state: "miss" };
}

/**
 * Words that identify nothing: placeholders, and the city and country names
 * that sit in every address. A query left with none of its own is not a venue
 * and must never be sent — "TBA, Bangkok" is answered with the city centre.
 */
const GENERIC = new Set([
  "tba", "tbc", "tbd", "online", "venue", "secret", "location", "announced",
  "bangkok", "chiang", "mai", "phuket", "thailand", "krung", "thep", "nakhon",
  "district", "amphur", "amphoe", "tambon", "khet", "khwaeng", "road", "rd",
  "soi", "alley", "lane", "moo", "the", "and",
]);

/** A venue that says it is not announced yet. Whatever follows is not an address. */
const UNANNOUNCED = /\b(tba|tbc|tbd)\b|to be (announced|confirmed)/i;

/** Is there anything distinctive to search for, or is this just a city name? */
export function worthAsking(venue: string | null, address: string | null): boolean {
  // "TBA - BLOQ Bangkok" has a distinctive word in it and is still not a place.
  if (venue && UNANNOUNCED.test(venue)) return false;
  return venueKey(venue, address)
    .split(" ")
    .some((w) => w.length > 2 && !GENERIC.has(w) && !/^\d+$/.test(w));
}

/** What we ask the geocoder. Kept beside the key so the two never drift apart. */
export function queryFor(venue: string | null, address: string | null): string {
  return [venue, address].filter(Boolean).join(", ").replace(/\s+/g, " ").trim().slice(0, 300);
}
