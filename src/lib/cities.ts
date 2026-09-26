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
  /** How far out still counts as this city. Per city: a province is not a fixed radius. */
  radiusKm: number;
}[] = [
  // 75km reaches Chiang Dao and the Yi Peng sites, still inside Chiang Mai
  // province, and stops short of Pai in Mae Hong Son at 85km. Measured 26 Sep.
  { id: "chiang-mai", label: "Chiang Mai", meetupSlug: "th--Chiang-Mai", eventbriteSlug: "thailand--chiang-mai", lat: 18.7883, lng: 98.9853, radiusKm: 75 },
  // 50km covers Rangsit, Samut Prakan and Nonthaburi; Chonburi and Pattaya are
  // separate markets a rep would not drive to on a Bangkok list.
  { id: "bangkok", label: "Bangkok", meetupSlug: "th--Bangkok", eventbriteSlug: "thailand--bangkok", lat: 13.7563, lng: 100.5018, radiusKm: 50 },
  // The island is 50km end to end, so 50km covers it and the nearest mainland.
  { id: "phuket", label: "Phuket", meetupSlug: "th--Phuket", eventbriteSlug: "thailand--phuket", lat: 7.8804, lng: 98.3923, radiusKm: 50 },
];

export function findCity(id: string) {
  return CITIES.find((c) => c.id === id);
}
