export type RawEvent = Record<string, unknown>;

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const LD_BLOCK = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

export async function fetchHtml(url: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(url, {
    signal,
    redirect: "follow",
    headers: { "User-Agent": UA, Accept: "text/html", "Accept-Language": "en-US,en;q=0.9" },
  });
  if (!res.ok) throw new Error(`${new URL(url).hostname} returned ${res.status}`);
  return res.text();
}

/**
 * Pull schema.org Events out of ld+json blocks, whether published directly
 * (Meetup) or wrapped in an ItemList (Eventbrite, Luma).
 */
export function extractEvents(html: string): RawEvent[] {
  const out: RawEvent[] = [];
  const push = (v: unknown) => {
    if (v && typeof v === "object" && (v as RawEvent)["@type"] === "Event") out.push(v as RawEvent);
  };
  for (const m of html.matchAll(LD_BLOCK)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(m[1].trim());
    } catch {
      continue; // one malformed block must not lose the rest of the page
    }
    for (const node of Array.isArray(parsed) ? parsed : [parsed]) {
      if (!node || typeof node !== "object") continue;
      push(node);
      const list = (node as Record<string, unknown>).itemListElement;
      if (Array.isArray(list)) {
        for (const entry of list) {
          push(entry && typeof entry === "object" ? (entry as Record<string, unknown>).item : null);
          push(entry);
        }
      }
    }
  }
  return out;
}

/** Fetch several listing pages and merge, so one 404 never loses the rest. */
export async function fetchAll(urls: string[], signal?: AbortSignal): Promise<RawEvent[]> {
  const pages = await Promise.allSettled(urls.map((u) => fetchHtml(u, signal)));
  const ok = pages.filter((p) => p.status === "fulfilled");
  if (ok.length === 0) {
    const first = pages[0] as PromiseRejectedResult;
    throw first.reason instanceof Error ? first.reason : new Error(String(first.reason));
  }
  return ok.flatMap((p) => extractEvents((p as PromiseFulfilledResult<string>).value));
}
