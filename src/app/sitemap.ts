import type { MetadataRoute } from "next";
import { CITIES } from "../lib/cities.ts";
import { SITE } from "../lib/site.ts";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE, lastModified: now, changeFrequency: "daily" as const, priority: 1 },
    ...CITIES.map((c) => ({
      url: `${SITE}/events/${c.id}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.9,
    })),
  ];
}
