import type { Fixed } from "../lib/venues.ts";

/**
 * Venue coordinates, filled once by `npm run geocode` and committed. A venue
 * does not move, so this is read for free forever and nothing is bought on a
 * page rebuild. `null` means looked up and not found — kept so the next run
 * does not pay to ask again.
 */
export const VENUES: Record<string, Fixed | null> = {
  "café del mar phuket": { lat: 7.9620862, lng: 98.284317 },
};
