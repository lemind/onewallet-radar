import type { CityId } from "../types.ts";

// Slugs are Meetup's own and are not derivable from the id — each was looked up by hand.
export const CITIES: { id: CityId; label: string; meetupSlug: string }[] = [
  { id: "chiang-mai", label: "Chiang Mai", meetupSlug: "th--Chiang-Mai" },
  { id: "bangkok", label: "Bangkok", meetupSlug: "th--Bangkok" },
  { id: "phuket", label: "Phuket", meetupSlug: "th--Phuket" },
];

export function findCity(id: string) {
  return CITIES.find((c) => c.id === id);
}
