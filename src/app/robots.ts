import type { MetadataRoute } from "next";
import { SITE } from "../lib/site.ts";

export default function robots(): MetadataRoute.Robots {
  return {
    // The scraping endpoint is not a page; crawling it would run live fetches for nothing.
    rules: [{ userAgent: "*", allow: "/", disallow: "/api/" }],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
