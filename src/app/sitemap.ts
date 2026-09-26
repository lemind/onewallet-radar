import type { MetadataRoute } from "next";
import { CITIES } from "../lib/cities.ts";
import { SITE } from "../lib/site.ts";
import { toLocal } from "../lib/time.ts";

// Refreshed daily so lastmod tracks the listings, which change every day.
// `priority` and `changeFrequency` are deliberately absent: Google ignores both.
export const revalidate = 86400;

export default function sitemap(): MetadataRoute.Sitemap {
  // Date only, in Bangkok terms: claiming a precise timestamp we cannot stand
  // behind is what makes a crawler distrust lastmod altogether.
  const lastModified = toLocal(new Date(), "date");
  return [
    // No trailing slash: this must match the canonical the page emits exactly.
    { url: SITE, lastModified },
    ...CITIES.map((c) => ({ url: `${SITE}/events/${c.id}`, lastModified })),
  ];
}
