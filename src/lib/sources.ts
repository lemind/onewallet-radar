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
    // fiftyMiles adds a couple of events per city; hundredMiles and beyond add
    // nothing, so the wider radii are not worth the extra fetch.
    id: "meetup",
    urls: {
      "chiang-mai": muPaths("th--Chiang-Mai"),
      bangkok: muPaths("th--Bangkok"),
      phuket: muPaths("th--Phuket"),
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
  {
    // The city page carries the events; its category sub-pages repeat the same
    // set, so one fetch per city is enough. Measured 25 Sep: Chiang Mai 40,
    // Bangkok 65, Phuket 13, all with venue, address and coordinates.
    id: "allevents",
    urls: {
      "chiang-mai": ["https://allevents.in/chiang-mai/"],
      bangkok: ["https://allevents.in/bangkok/"],
      phuket: ["https://allevents.in/phuket/"],
    },
  },
];

function muPaths(slug: string): string[] {
  const base = `https://www.meetup.com/find/?location=${slug}&source=EVENTS`;
  return [base, `${base}&distance=fiftyMiles`];
}

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
