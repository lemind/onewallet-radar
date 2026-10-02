import { VENUES } from "../data/venues.ts";

/**
 * Venue coordinates, read from a file in the repository. Nothing here touches
 * the network: a geocoding call that runs on a page rebuild bills on every
 * rebuild, and the 30-day cache it relied on does not survive a deploy.
 * Measured 2 Oct: that mistake cost $40. Fill the file with `npm run geocode`.
 */
export type Fixed = { lat: number; lng: number };

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

/** Null for a venue we have never looked up, and for one that was looked up and not found. */
export function fixedPoint(venue: string | null, address: string | null): Fixed | null {
  const hit = VENUES[venueKey(venue, address)];
  return hit ?? null;
}
