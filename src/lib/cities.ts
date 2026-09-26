import type { CityId } from "../types.ts";

// Slugs are Meetup's own and are not derivable from the id — each was looked up by hand.
export const CITIES: {
  id: CityId;
  label: string;
  meetupSlug: string;
  eventbriteSlug: string;
  /** City centre, used to reject listings a source files under the city but holds elsewhere. */
  lat: number;
  lng: number;
}[] = [
  { id: "chiang-mai", label: "Chiang Mai", meetupSlug: "th--Chiang-Mai", eventbriteSlug: "thailand--chiang-mai", lat: 18.7883, lng: 98.9853 },
  { id: "bangkok", label: "Bangkok", meetupSlug: "th--Bangkok", eventbriteSlug: "thailand--bangkok", lat: 13.7563, lng: 100.5018 },
  { id: "phuket", label: "Phuket", meetupSlug: "th--Phuket", eventbriteSlug: "thailand--phuket", lat: 7.8804, lng: 98.3923 },
];

export function findCity(id: string) {
  return CITIES.find((c) => c.id === id);
}
