import type { CityId } from "../types.ts";
import type { FetchAllResult, RawEvent } from "./ldjson.ts";
import { toLocal } from "./time.ts";

// HACK(ra): ra.co's HTML is behind DataDome (403), but its GraphQL endpoint
// answers unauthenticated. Measured 26 Sep: 118 Thailand events, 37 venues, 40
// promoters. It is an internal API and may change without notice.
// REVISIT: drop to a plain fetch if ra.co ever serves its listings as ld+json.
const ENDPOINT = "https://ra.co/graphql";

// RA has no Chiang Mai area, so the Thailand-wide area is the only feed that
// reaches it; the city is then matched off the venue. Looked up 26 Sep.
const THAILAND_AREA = 67;

const PAGE_SIZE = 50;
const MAX_PAGES = 3;

const QUERY = `query GET_EVENT_LISTINGS($filters: FilterInputDtoInput, $pageSize: Int, $page: Int, $sort: SortInputDtoInput) {
  eventListings(filters: $filters, pageSize: $pageSize, page: $page, sort: $sort) {
    data { event { title startTime endTime contentUrl
      venue { name address area { name } }
      promoters { id name } } }
    totalResults
  }
}`;

/** Each city as RA spells it on a venue; RA labels everything outside Bangkok "All". */
const CITY_MATCH: Record<CityId, RegExp> = {
  "chiang-mai": /chiang\s?mai|เชียงใหม่/i,
  bangkok: /bangkok|krung\s?thep|กรุงเทพ/i,
  phuket: /phuket|ภูเก็ต/i,
};

type RaEvent = {
  title?: string;
  startTime?: string;
  endTime?: string;
  contentUrl?: string;
  venue?: { name?: string; address?: string; area?: { name?: string } | null } | null;
  promoters?: { id?: string; name?: string }[] | null;
};

/** Map RA's own shape onto schema.org so normalize() handles it like every other source. */
function toSchemaOrg(e: RaEvent): RawEvent {
  const promoter = e.promoters?.find((p) => p.name);
  return {
    "@type": "Event",
    name: e.title,
    url: e.contentUrl ? `https://ra.co${e.contentUrl}` : undefined,
    // RA publishes a naive local time; parseStart reads that as Bangkok. See SPEC.md 7.1.
    startDate: e.startTime,
    endDate: e.endTime,
    location: e.venue?.name
      ? { "@type": "Place", name: e.venue.name, address: e.venue.address ?? undefined }
      : undefined,
    organizer: promoter
      ? {
          "@type": "Organization",
          name: promoter.name,
          url: promoter.id ? `https://ra.co/promoters/${promoter.id}` : undefined,
        }
      : undefined,
  };
}

function inCity(e: RaEvent, city: CityId): boolean {
  const hay = [e.venue?.name, e.venue?.address, e.venue?.area?.name].filter(Boolean).join(" ");
  return CITY_MATCH[city].test(hay);
}

type Page = { rows: number; events: RaEvent[] };

async function page(from: string, to: string, n: number, signal?: AbortSignal): Promise<Page> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      // RA rejects the call without a matching Origin and Referer.
      Origin: "https://ra.co",
      Referer: "https://ra.co/events/th/bangkok",
    },
    body: JSON.stringify({
      operationName: "GET_EVENT_LISTINGS",
      variables: {
        filters: { areas: { eq: THAILAND_AREA }, listingDate: { gte: from, lte: to } },
        pageSize: PAGE_SIZE,
        page: n,
        sort: { listingDate: { order: "ASCENDING" } },
      },
      query: QUERY,
    }),
  });
  if (!res.ok) throw new Error(`ra.co returned ${res.status}`);
  const body = (await res.json()) as {
    data?: { eventListings?: { data?: { event?: RaEvent }[] } };
    errors?: unknown[];
  };
  if (body.errors?.length) {
    // Keep RA's own message: a renamed field and a block are different problems.
    const first = body.errors[0] as { message?: string } | undefined;
    throw new Error(`ra.co rejected the query${first?.message ? `: ${first.message}` : ""}`);
  }
  const rows = body.data?.eventListings?.data ?? [];
  return { rows: rows.length, events: rows.map((r) => r.event).filter(Boolean) as RaEvent[] };
}

/**
 * Fetch RA listings for a city, shaped like fetchAll so the route treats it as
 * one more source. Pages are sequential: RA returns a short page when it is done.
 */
export async function fetchRa(
  city: CityId,
  from: Date,
  to: Date,
  signal?: AbortSignal,
): Promise<FetchAllResult> {
  const gte = toLocal(from, "date");
  const lte = toLocal(to, "date");
  const events: RawEvent[] = [];
  let reason: string | undefined;
  let done = false;
  let n = 1;

  for (; n <= MAX_PAGES && !done; n++) {
    let batch: Page;
    try {
      batch = await page(gte, lte, n, signal);
    } catch (err) {
      // Keep the pages already fetched: a later page failing is a short result,
      // not an empty one. Matches fetchAll, which never discards what it has.
      if (n === 1) throw err;
      reason = err instanceof Error ? err.message : String(err);
      break;
    }
    for (const e of batch.events) if (inCity(e, city)) events.push(toSchemaOrg(e));
    // Count rows RA returned, not rows that survived parsing, or one dropped
    // row would read as the last page and the remaining pages go unfetched.
    if (batch.rows < PAGE_SIZE) done = true;
  }

  // Hitting the cap with a full page means RA had more to give; say so rather
  // than let a truncated range look like a complete one.
  if (!done && !reason) reason = `stopped at the first ${MAX_PAGES * PAGE_SIZE} listings`;
  return { events, failed: reason ? 1 : 0, total: MAX_PAGES, reason };
}
