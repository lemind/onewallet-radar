import type { MetadataRoute } from "next";
import { SITE } from "../lib/site.ts";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: SITE, lastModified: new Date(), changeFrequency: "daily", priority: 1 }];
}
