# Phase 1 Data Model: Event-Sourced Partner Lead Finder

**Date**: 2026-09-24 | **Plan**: [plan.md](./plan.md)

No database. These are in-memory shapes that exist for the duration of one
request, plus one cached shape that arrives in Phase 7.

---

## Pipeline

```
Meetup city listing HTML
        │
        ▼  extract  <script type="application/ld+json">, keep @type == "Event"
RawEvent  (schema.org shape, source-specific)
        │
        ▼  normalize  flatten address, lift organizer, convert time
Event (unenriched)   venueMatch = "not_attempted"
        │
        ▼  filter  online / venueless / undated / out-of-range / duplicate
Event[] (kept)  +  dropped counters
        │
        ▼  enrich  Places Text Search → Details, confidence gate   [Phase 7]
Event[] (enriched)   venueMatch = "matched" | "unmatched"
        │
        ├──▶  RunResult  →  JSON  →  page
        └──▶  CSV row    →  download
```

Each stage is a pure function from data to data. Only the first and the
enrichment stage touch the network, which is what lets everything else be tested
against fixtures offline.

---

## Entities

### `RawEvent` — what the source publishes

Not a stored type; the shape the parser reads. Fields used, per schema.org:

| Field | Use |
|---|---|
| `name` | event name |
| `url` | source link — **mandatory**, a record without one is dropped |
| `startDate` | ISO 8601 with offset, e.g. `2026-09-24T11:00:00.000Z` |
| `endDate` | often `""` — empty string, not null |
| `eventAttendanceMode` | online detection |
| `location.name` | venue name |
| `location.address.*` | `streetAddress`, `addressLocality`, `addressRegion`, `postalCode` |
| `organizer.name` / `organizer.url` | the organizer lead — present on 12/12 measured |

Everything else on the record, including `description`, is discarded. Meetup's
descriptions are large and carry nothing a BD user needs.

### `Event` — one row of output

```ts
type VenueMatch = "matched" | "unmatched" | "not_attempted";

type Event = {
  source: "meetup";

  name: string;
  url: string;                    // always present; the traceability guarantee

  // Time — see "Time handling" below
  startUtc: string;               // ISO 8601 UTC, exactly as published
  startLocal: string;             // Asia/Bangkok, what humans read
  startPrecision: "datetime";     // single-member union on purpose
  end: string | null;             // "" from source normalizes to null

  // Lead 1 — venue (merchant prospect)
  venue: string | null;
  address: string | null;
  district: string | null;        // Places only
  phone: string | null;           // Places only
  website: string | null;         // Places only
  venueMatch: VenueMatch;

  // Lead 2 — organizer (referral channel)
  organizer: string | null;
  organizerUrl: string | null;
};
```

**Invariants**

1. `url` is non-empty on every `Event` that reaches output.
2. `venue` or `address` is non-null — a record with neither is dropped.
3. If `venueMatch !== "matched"` then `district`, `phone` and `website` are all
   `null`. Enrichment is all-or-nothing; there is no partial fill.
4. `startLocal` is always derived from `startUtc`, never parsed separately.
5. `startPrecision` is `"datetime"` for every source in v1.

### `RunResult` — the response envelope

```ts
type RunResult = {
  city: CityId;
  from: string;                   // ISO date, inclusive
  to: string;                     // ISO date, inclusive
  fetchedAt: string;              // ISO 8601 UTC
  events: Event[];
  dropped: DroppedCounts;
  errors: SourceError[];
};

type DroppedCounts = {
  online: number;
  noVenue: number;
  noDate: number;
  outOfRange: number;
  duplicate: number;
};

type SourceError = {
  source: "meetup" | "places";
  message: string;
};
```

`dropped` is carried into the response, not just logged. Roughly half of raw
results are online events leaking into city searches, and a visible count is how
anyone notices a filter has started misbehaving.

`errors` is how degradation is expressed: a Places failure appends an entry and
leaves `events` intact. An empty `errors` array with an empty `events` array
means "nothing on this week" — a different answer from a failure, and FR-021
requires the UI to say so.

### `City` — the fixed list

```ts
type CityId = "chiang-mai" | "bangkok" | "phuket";

type City = {
  id: CityId;
  label: string;                  // "Chiang Mai"
  meetupSlug: string;             // "th--Chiang-Mai" — not derivable from the id
};
```

Three cities, hardcoded. Slugs are per-platform and must be looked up by hand,
which is one more reason a 77-province selector is not a small change.

### `CachedVenue` — Phase 7 only

```ts
type CachedVenue = {
  placeId: string;                // cache key
  district: string | null;
  phone: string | null;
  website: string | null;
  cachedAt: string;
};
```

TTL 7 days. A **failed** lookup is cached separately, keyed by normalized venue
name plus city, with a 1-hour TTL — long enough to stop a transient miss
re-billing on every run, short enough that a genuine fix appears the same day.

---

## Time handling

The single most error-prone part of this feature, so the rules are explicit.

| Step | Rule |
|---|---|
| Parse | Accept the published offset. `2026-09-24T11:00:00.000Z` is an instant, not a wall-clock reading. |
| Store | `startUtc` keeps that instant verbatim. Never rewrite the source value. |
| Render | `startLocal` = the same instant in `Asia/Bangkok`. That example is **18:00**, matching the event's own "6:00 PM" description. |
| Export | The CSV carries `start_local` only. There is no UTC column; UTC is stored, never shown. |
| Filter | Range comparison happens on the instant, with a 12-hour backward grace so an event already under way still appears. |
| Precision | A date-only source sets `startPrecision: "date"` and exports an empty time cell. It must never become midnight. |

Use a named zone (`Asia/Bangkok`), not a `+07:00` literal. Thailand has no DST,
so both work today; the named zone costs nothing and does not quietly become
wrong elsewhere.

---

## Filter rules

Applied in order. Each drop increments its counter.

| # | Rule | Counter |
|---|---|---|
| 1 | `eventAttendanceMode` ends with `OnlineEventAttendanceMode` | `online` |
| 2 | no `venue` **and** no `address` | `noVenue` |
| 3 | `startDate` missing or unparseable | `noDate` |
| 4 | start outside `[now − 12h, to]` | `outOfRange` |
| 5 | `(source, url)` already seen | `duplicate` |

Measured on Chiang Mai, 24 Sep: 18 online, 0 no-venue, 0 no-date, 3 out-of-range,
3 duplicate → 12 kept from 36 raw. **The port must reproduce these numbers
against the saved fixture**; that is the acceptance test for Phase 3.

---

## Grouping

Venues are 29 unique across 30 events — deduplicating them would remove a single
row, so there is no separate partner export.

Organizers do repeat: Chiang Mai had 9 events with an organizer but only **5
distinct organizers**, two of them running 3 events each. Where results are
grouped, group on `organizerUrl` — it is stable, whereas display names are not.
Grouping is presentational only; the event row remains the unit of output.
