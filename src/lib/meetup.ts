const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const LD_BLOCK = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

export type RawEvent = Record<string, unknown>;

export function meetupUrl(slug: string): string {
  return `https://www.meetup.com/find/?location=${encodeURIComponent(slug)}&source=EVENTS`;
}

export async function fetchListing(slug: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(meetupUrl(slug), {
    signal,
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`meetup returned ${res.status}`);
  return res.text();
}

/**
 * Pull schema.org Event records out of the page's ld+json blocks.
 * Meetup publishes real <script> tags, so no brace matching is needed.
 */
export function extractEvents(html: string): RawEvent[] {
  const out: RawEvent[] = [];
  for (const m of html.matchAll(LD_BLOCK)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(m[1].trim());
    } catch {
      continue; // one malformed block must not lose the rest of the page
    }
    for (const item of Array.isArray(parsed) ? parsed : [parsed]) {
      if (item && typeof item === "object" && (item as RawEvent)["@type"] === "Event") {
        out.push(item as RawEvent);
      }
    }
  }
  return out;
}
