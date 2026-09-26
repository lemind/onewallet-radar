// undici's own fetch, not the global: a standalone Agent is incompatible with the fetch Node bundles.
import { Agent, fetch as undiciFetch } from "undici";

export type RawEvent = Record<string, unknown>;

// HACK(bandsintown): Cloudflare fingerprints the TLS handshake, so Node's default is refused where Chrome's cipher order over h2 is let through. Measured 26 Sep: 403 -> 200.
// REVISIT: drop the dispatcher if a plain fetch starts succeeding.
const CHROME_CIPHERS = [
  "TLS_AES_128_GCM_SHA256",
  "TLS_AES_256_GCM_SHA384",
  "TLS_CHACHA20_POLY1305_SHA256",
  "ECDHE-ECDSA-AES128-GCM-SHA256",
  "ECDHE-RSA-AES128-GCM-SHA256",
  "ECDHE-ECDSA-AES256-GCM-SHA384",
  "ECDHE-RSA-AES256-GCM-SHA384",
  "ECDHE-ECDSA-CHACHA20-POLY1305",
  "ECDHE-RSA-CHACHA20-POLY1305",
  "ECDHE-RSA-AES128-SHA",
  "ECDHE-RSA-AES256-SHA",
  "AES128-GCM-SHA256",
  "AES256-GCM-SHA384",
  "AES128-SHA",
  "AES256-SHA",
].join(":");

const dispatcher = new Agent({
  allowH2: true,
  connect: { ciphers: CHROME_CIPHERS, ecdhCurve: "X25519:P-256:P-384", minVersion: "TLSv1.2" },
});

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const LD_BLOCK = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

export async function fetchHtml(url: string, signal?: AbortSignal): Promise<string> {
  const res = await undiciFetch(url, {
    signal,
    redirect: "follow",
    dispatcher,
    headers: {
      "User-Agent": UA,
      Accept: "text/html",
      "Accept-Language": "en-US,en;q=0.9",
      // HACK(bandsintown): 403s without these; a bare UA reads as a bot. Measured 26 Sep, 403 -> 200, 14 events. Harmless on the other four.
      // REVISIT: drop if bandsintown starts answering a plain request.
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    },
  });
  if (!res.ok) {
    // undici holds the socket out of the pool until the body is read or cancelled.
    await res.body?.cancel().catch(() => {});
    throw new Error(`${new URL(url).hostname} returned ${res.status}`);
  }
  return res.text();
}

/** Abortable so the route's deadline is not held open by a pending timer. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(done, ms);
    function done() {
      clearTimeout(t);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });
}

// One retry only. Measured 26 Sep: bandsintown serves roughly five requests
// then rate-limits, so a burst of retries burns the budget instead of clearing
// it. A run asks each host once, which is well inside the limit.
async function fetchHtmlRetrying(url: string, signal?: AbortSignal): Promise<string> {
  try {
    return await fetchHtml(url, signal);
  } catch (err) {
    if (signal?.aborted || !/returned 403/.test(String(err))) throw err;
    await sleep(1200, signal);
    if (signal?.aborted) throw err;
    return fetchHtml(url, signal);
  }
}

/** Event and its subtypes: bandsintown publishes MusicEvent, and a bare "Event" test drops every one. */
function isEventType(t: unknown): boolean {
  const list = Array.isArray(t) ? t : [t];
  // schema.org allows a bare name or a full URL, so compare on the last segment.
  return list.some((x) => typeof x === "string" && x.split("/").pop()!.endsWith("Event"));
}

/**
 * Pull schema.org Events out of ld+json blocks, whether published directly
 * (Meetup) or wrapped in an ItemList (Eventbrite, Luma).
 */
export function extractEvents(html: string): RawEvent[] {
  const out: RawEvent[] = [];
  const push = (v: unknown) => {
    if (v && typeof v === "object" && isEventType((v as RawEvent)["@type"])) out.push(v as RawEvent);
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

export type FetchAllResult = { events: RawEvent[]; failed: number; total: number; reason?: string };

/**
 * Fetch several listing pages and merge, so one 404 never loses the rest.
 * Reports how many pages failed: a source that answered on 1 of 8 URLs is a
 * truncated result, not a clean one, and the caller has to be able to say so.
 */
export async function fetchAll(urls: string[], signal?: AbortSignal): Promise<FetchAllResult> {
  const pages = await Promise.allSettled(urls.map((u) => fetchHtmlRetrying(u, signal)));
  const ok = pages.filter((p) => p.status === "fulfilled") as PromiseFulfilledResult<string>[];
  const bad = pages.filter((p) => p.status === "rejected") as PromiseRejectedResult[];
  const reason = bad.length
    ? bad[0].reason instanceof Error
      ? bad[0].reason.message
      : String(bad[0].reason)
    : undefined;
  if (ok.length === 0) throw new Error(reason ?? "all listing pages failed");
  return {
    events: ok.flatMap((p) => extractEvents(p.value)),
    failed: bad.length,
    total: urls.length,
    reason,
  };
}
