import type { CityId } from "../types.ts";

// Slugs are Meetup's own and are not derivable from the id — each was looked up by hand.
export const CITIES: {
  id: CityId;
  label: string;
  meetupSlug: string;
  eventbriteSlug: string;
}[] = [
  { id: "chiang-mai", label: "Chiang Mai", meetupSlug: "th--Chiang-Mai", eventbriteSlug: "thailand--chiang-mai" },
  { id: "bangkok", label: "Bangkok", meetupSlug: "th--Bangkok", eventbriteSlug: "thailand--bangkok" },
  { id: "phuket", label: "Phuket", meetupSlug: "th--Phuket", eventbriteSlug: "thailand--phuket" },
];

export function findCity(id: string) {
  return CITIES.find((c) => c.id === id);
}
