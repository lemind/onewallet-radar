import type { RawEvent } from "./meetup.ts";

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const LD_BLOCK = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

export function eventbriteUrl(slug: string): string {
  return `https://www.eventbrite.com/d/${slug}/events/`;
}

export async function fetchListing(slug: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(eventbriteUrl(slug), {
    signal,
    headers: { "User-Agent": UA, Accept: "text/html", "Accept-Language": "en-US,en;q=0.9" },
  });
  if (!res.ok) throw new Error(`eventbrite returned ${res.status}`);
  return res.text();
}

/**
 * Eventbrite publishes a schema.org ItemList whose items are Events —
 * standard markup, not the internal JS blob the prototype had to dig through.
 */
export function extractEvents(html: string): RawEvent[] {
  const out: RawEvent[] = [];
  for (const m of html.matchAll(LD_BLOCK)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    for (const node of Array.isArray(parsed) ? parsed : [parsed]) {
      if (!node || typeof node !== "object") continue;
      const list = (node as Record<string, unknown>).itemListElement;
      if (!Array.isArray(list)) continue;
      for (const entry of list) {
        const item = (entry as Record<string, unknown>)?.item;
        if (item && typeof item === "object" && (item as RawEvent)["@type"] === "Event") {
          out.push(item as RawEvent);
        }
      }
    }
  }
  return out;
}
