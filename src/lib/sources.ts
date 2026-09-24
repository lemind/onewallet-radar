import type { CityId, Source } from "../types.ts";

/**
 * Listing URLs per source per city. Several paths per source on purpose:
 * Eventbrite's category pages each surface events the base page omits,
 * so fetching a handful raises the yield measurably.
 */
export const SOURCES: {
  id: Source;
  urls: Partial<Record<CityId, string[]>>;
}[] = [
  {
    id: "meetup",
    urls: {
      "chiang-mai": ["https://www.meetup.com/find/?location=th--Chiang-Mai&source=EVENTS"],
      bangkok: ["https://www.meetup.com/find/?location=th--Bangkok&source=EVENTS"],
      phuket: ["https://www.meetup.com/find/?location=th--Phuket&source=EVENTS"],
    },
  },
  {
    id: "eventbrite",
    urls: {
      "chiang-mai": ebPaths("thailand--chiang-mai"),
      bangkok: ebPaths("thailand--bangkok"),
      phuket: ebPaths("thailand--phuket"),
    },
  },
  {
    // Luma publishes city pages only where it has a community; Chiang Mai and
    // Phuket redirect to /discover, so they are simply absent here.
    id: "luma",
    urls: { bangkok: ["https://luma.com/bangkok"] },
  },
];

function ebPaths(slug: string): string[] {
  const base = `https://www.eventbrite.com/d/${slug}`;
  return [
    `${base}/events/`,
    `${base}/all-events/`,
    `${base}/business--events/`,
    `${base}/food-and-drink--events/`,
    `${base}/music--events/`,
    `${base}/community--events/`,
  ];
}

export function urlsFor(source: Source, city: CityId): string[] {
  return SOURCES.find((s) => s.id === source)?.urls[city] ?? [];
}
