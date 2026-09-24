# onewallet-radar — Spec

**Version** 0.2.1 · 2026-09-24
**Status** Approved to build — no further spec iteration before milestone 1
**Source brief** "One Wallet Partner Finder", Sunny (Business Development), 24 Sep 2026
**Changes from 0.1** see §13

---

## 1. Purpose

Find businesses in Thai cities worth approaching as One Wallet partners, by using
public events as the discovery signal.

Events are the lead source because each one yields two prospects:

| Output | What it is | Value |
|---|---|---|
| **Venue** | Where the event is held | Often a café, bar, coworking or coliving space — a merchant lead |
| **Organizer** | Who runs the event | Has a standing audience of expats and nomads — a referral channel |

The team currently does this by hand, one city at a time. This makes it repeatable.

**This tool finds who to approach. It does not do outreach.** Public data rarely
contains a decision-maker's personal contact; it gives a business name, address,
phone and website. A human still makes the call.

**Primary job:** generate a small, actionable prospect list for weekly BD review.
**Not:** continuously monitor the Thai events ecosystem. Measured volume is
10–15 usable events per city per week (§9.2). Sizing the UI, the infrastructure
or the pitch for more than that is misleading.

---

## 2. Users

3–5 internal staff (BD, Partnership Manager, executives). No public access.
No roles or permissions in v1 — everyone sees the same thing.

Internal does not mean unprotected: see §9.10.

---

## 3. Flow

```
open site
   ↓
pick city + date range
   ↓
press [Run]
   ↓
fetch Meetup on demand  (no cache in v1 — see §9.13)
   ↓
normalize + filter
   ↓
enrich venue via Places  →  district, phone, website
   ↓
download CSV
```

One page. No login in v1, but the deployment is access-protected (§9.10).
No stored pipeline. The output is a spreadsheet the team works from directly.

**District is not a query dimension.** It is a column on the result, produced by
enrichment after the scrape. BD sorts or filters the spreadsheet by it. See §9.4
for why: district reduces an already small list substantially, and making it a
selector is the main thing that would force Places onto the critical path.

---

## 4. Scope

### In scope (v1)

- City + date-range selection
- On-demand fetch of Meetup
- Filter out online, venueless and out-of-range events
- Venue enrichment via Google Places: district, phone, website
- District as an output column, sortable in the CSV
- Organizer name and organizer URL on every row that has one
- CSV download, times rendered in `Asia/Bangkok`
- A venue cache, but only once Places lands (§9.13) — it is cost control, not speed

### Explicitly out of scope

Map view · pipeline / CRM · login system · Thai UI · vendor and sponsor lists ·
fit scoring · Telegram alerts · all 77 provinces · contract uploads ·
importing existing data · district as a search input · Eventbrite (§6.2) ·
Google rating (§6.4)

Do not add scoring yet. Neither the partner definition (§10.1) nor the data
quality is settled enough for a score to mean anything.

---

## 5. Stack

| Layer | Choice | Rationale |
|---|---|---|
| Language | TypeScript, Node 22 | One language end to end |
| App | Next.js on Vercel | Single deployment — no separate frontend and backend |
| Scrape | Route handler, native `fetch` | ~120 lines; no framework, no headless browser |
| Enrichment | Google Places Text Search + Place Details | Only external key the project needs |
| Cache | **None in v1**; Redis via Vercel Marketplace when Places lands | Vercel KV is sunset; serverless has no writable disk, so a cache means an add-on — do not add one before it earns its keep (§9.13) |
| Output | CSV, UTF-8 **with BOM** | Opens in Excel; BOM is required or Thai text corrupts |
| Access | Vercel Authentication, scope **All Deployments** | Keeps an internal tool internal without building auth (§9.10) |
| Deploy | Vercel, `lemind` | CLI already authenticated |

**Not Fastify.** It is a long-running server; Vercel runs serverless functions.
Use Fastify only if this moves to a VM.

**No database.** Nothing in v1 is written by a human, so nothing needs durable
storage. A database becomes necessary the moment a pipeline with notes and
stages is added.

---

## 6. Data sources

### 6.1 Used in v1

| Source | Method | Organizer | Time precision |
|---|---|---|---|
| **Meetup** | `application/ld+json` in raw HTML | yes, 12/12 measured | full timestamp |

Meetup is the only source in v1. It is the only one that returns an organizer,
the only one with usable time precision, and it produced 22 of the 30 measured
events across three cities.

### 6.2 Deferred: Eventbrite

Eventbrite worked in the prototype and is **deliberately deferred**, not merely
deprioritized. It contributed 8 of 30 measured events and costs:

- **no organizer field** — its rows deliver one lead instead of two
- **date-only timestamps** — every measured record is `00:00:00` with no offset,
  which cannot be represented honestly alongside real timestamps (§7.1)
- **a brittle parser** — it reads `window.__SERVER_DATA__`, an internal
  structure that can change without notice or version

Dropping it removes the entire date-precision problem and the most fragile code
in the project, at a cost of ~25% of volume in the lowest-value rows. Revisit
once v1 is in daily use and someone asks for more volume.

### 6.3 Evaluated and rejected

| Source | Reason |
|---|---|
| Eventpop | 2.7 KB shell — fully JS-rendered |
| Ticketmelon | JS-rendered, no structured data |
| tourismthailand.org | HTTP 403, bot-blocked |
| allevents.in | JSON-LD contains only FAQ and breadcrumb data |
| Chiang Mai Citylife | No event schema; would need a bespoke parser |

Eventpop and Ticketmelon are Thai-language platforms and are the route to
provincial Thai events. Reaching them needs a rendering scraper such as
Firecrawl. That is a later phase, not v1.

### 6.4 Places fields

Request only district, phone and website. **`rating` is cut from v1** — it is
not an input to any BD decision, and it sits in a more expensive field tier.
Add it only if Sunny states that Google rating changes who gets contacted.

---

## 7. Data model

```ts
type Event = {
  source: "meetup";

  name: string;
  url: string;                    // source link, always present

  // Time — see 7.1
  startUtc: string;               // ISO 8601 UTC, exactly as published
  startLocal: string;             // Asia/Bangkok, what a human reads
  startPrecision: "datetime";     // single-member union on purpose — see 7.1
  end: string | null;

  // Lead 1 — venue
  venue: string | null;
  address: string | null;
  district: string | null;        // Places only, null when unmatched
  phone: string | null;           // Places only, null when unmatched
  website: string | null;         // Places only, null when unmatched
  venueMatch: "matched" | "unmatched" | "not_attempted";

  // Lead 2 — organizer
  organizer: string | null;
  organizerUrl: string | null;    // present on 12/12 measured Meetup events
};
```

`url` is mandatory on every row. Every result must be traceable to its source so
a human can verify it.

### 7.1 Time is an output contract

Meetup publishes UTC: `2026-09-24T11:00:00.000Z` for an event whose own
description reads *6:00 PM – 8:00 PM*. That is 18:00 `Asia/Bangkok`.

- **Store** `startUtc` exactly as published — never rewrite the source value.
- **Render and export** `startLocal` in `Asia/Bangkok`. Raw UTC must never reach
  a BD user; a 6pm meetup shown as 11:00 is a wrong answer, not a formatting
  quirk.
- **Never invent precision.** A source that publishes a date with no time must
  carry `startPrecision: "date"` and export a date with an empty time cell. It
  must not become midnight.

`startPrecision` has exactly one legal value in v1, because Meetup is the only
source and it always publishes a full timestamp. Keep the field anyway: it is a
compile-time-only annotation that costs nothing at runtime, and it is what
forces the next person adding a date-only source to handle the case rather than
silently defaulting to midnight. Widening the union is how Eventbrite comes
back (§6.2).

### 7.2 Organizer is the grouping key

Measured in Chiang Mai: 9 events with an organizer, but only **5 distinct
organizers** — two groups ran 3 events each. Venues, by contrast, were 29
distinct across 30 events, so venue-level deduplication would remove a single
row and is not worth a second export.

Therefore **the event row stays the unit of output**, and repeated events
resolve to the same organizer identity via `organizerUrl` (stable) rather than
`organizer` name (not guaranteed stable). Grouping is presentational — sort the
CSV by organizer, or collapse in the UI. No separate `partners.csv` in v1.

### 7.3 Filter rules

Drop a scraped record when any of these is true:

- `eventAttendanceMode` is online
- no venue **and** no address
- no parseable start date
- start date outside the requested range
- duplicate `(source, url)`

### 7.4 Response envelope

```ts
type RunResult = {
  city: string;
  from: string;
  to: string;
  fetchedAt: string;
  cached: boolean;
  events: Event[];
  dropped: Record<string, number>;         // why rows were filtered out
  errors: { source: string; message: string }[];   // see §9.11
};
```

---

## 8. Output

CSV, one row per event, UTF-8 with BOM, sorted by start ascending.

```
name, start_local, organizer, organizer_url, venue, district,
address, phone, website, source, url
```

`start_local` is `Asia/Bangkok`. There is no UTC column — it is stored, not
exported. `rating` is not a column (§6.4).

---

## 9. Restrictions and known limits

Measurements below come from a 7-day window scraped on 24 Sep 2026 across three
cities, 30 events total. They should be read before promising anything.

### 9.1 Geographic coverage is narrow

Meetup and Eventbrite are expat-facing platforms. Measured yield:

| City | Events | With organizer |
|---|---|---|
| Chiang Mai | 12 | 9 |
| Bangkok | 13 | 9 |
| Phuket | 5 | 4 |

**Measured:** these three cities produce usable volume.
**Inferred, not measured:** coverage outside them approaches zero, because
provincial Thai events are announced in Thai on Facebook Events and Thai
ticketing sites, neither of which this tool can reach.

On that inference, **a 77-province selector would be empty in roughly 74 of
them** and should not be shipped. The inference has not been tested province by
province and should be treated as the working assumption until it is. It is
cheap to be wrong in one direction and expensive in the other: verifying costs
an afternoon of scraping, while shipping the selector costs a demo that returns
nothing.

### 9.2 Volume is low by design

Roughly 10–15 usable events per city per week. This is a list a person reads on
a Monday, not a data feed. See §1 — this is a product definition, not a caveat.

### 9.3 Vendor and sponsor lists do not exist

The source brief asks for vendors and sponsors per event. This data is not
published for meetups or provincial festivals, and only sporadically for large
conferences. **Venue and organizer are the real outputs.** Any UI promising
vendors will show an empty panel.

### 9.4 District is enrichment-only, and therefore a column

Meetup does publish `addressLocality`, on 10 of 12 measured Chiang Mai events.
The problem is not absence — it is that the administrative level is
inconsistent:

| Published `addressLocality` | Actual level |
|---|---|
| `Amphoe Mueang Chiang Mai` | district |
| `Tambon Si Phum` | subdistrict |
| `Chiang Mai` | city |
| `Thailand` | country |

The same venue (Spice Garden) returned `Amphoe Mueang Chiang Mai` on one event
and `Tambon Si Phum` on another. A parser cannot normalize these to one
administrative level, so district requires Places enrichment.

Two keyless alternatives were tested and both failed:

- Scraping Google search results — blocked by a JavaScript wall from a
  residential IP; datacenter IPs get CAPTCHA
- Nominatim / OpenStreetMap — matched **1 of 6** venues. It is an address
  database, not a business database; small Thai venues are not in it

**Consequence for the design.** If district were a search input, every run would
enrich every venue city-wide just to discard most of them, putting a billable
API on the critical path of the main button. As a column it is additive: the
tool works without a key, and enrichment improves it. At 10–15 events per city
per week, filtering 12 rows down to 3 is also not worth a dropdown.

### 9.5 Running the fetch from Vercel is untested and load-bearing

Vercel functions run from AWS datacenter ranges, which is what scraping targets
commonly filter. **A block means the button returns nothing, in front of the
user.**

This must be verified before anything is built on it, and the test asserts more
than a 200:

```
deploy one throwaway function
→ fetch Meetup Chiang Mai
→ assert HTTP status
→ assert response size is in the expected range
→ assert the body contains application/ld+json with @type Event
→ record elapsed time
→ repeat 3–5 times over at least an hour
```

One success proves nothing if the filtering is intermittent or reputation-based.
If it fails, the fallbacks are: move the fetch to GitHub Actions on a schedule
and commit the JSON, or route it through a rendering service with proxy
rotation.

### 9.6 Serverless execution limits are not the risk

A single-city scrape takes 2–4 seconds, far inside any Vercel timeout tier. The
real risks are §9.5 (blocked), §6.2 (source schema changes) and §9.9 (Places
matching and cost) — not execution duration.

### 9.7 Terms of service

robots.txt on Meetup permits the listing paths used here. Meetup's **terms of
service** separately restrict automated collection. This is acceptable for an
internal prototype and is a real question before anything public or commercial.
Using a third-party scraping service does not change it — it changes who fetches
the page, not whether the site permits it.

### 9.8 Noise

Roughly 50% of raw results are online events that leak into city searches (e.g.
an India-based online class appearing under Chiang Mai). The no-physical-venue
filter removes them. Expect the raw count to be about double the useful count.

### 9.9 Places matching is the hidden accuracy risk

Text Search returns relevance-ranked candidates, not exact matches. `The Edge`
on Nimman Road may come back as `The Edge Cafe` — or as `The Edge Apartments`.

**A wrong phone number is worse than a missing one**, because the stated purpose
is a human picking up the phone. Therefore:

- Attach enrichment only when the match is confident — name similarity above
  threshold **and** the returned place located inside the requested city
- Otherwise set `venueMatch: "unmatched"` and leave district, phone and website
  null
- Never partially attach: an unmatched venue yields no enriched fields at all
- Surface `venueMatch` in the UI so a human can see what was and was not
  verified

**Keep the matcher deliberately dumb.** This is not entity resolution:

```
take candidate #1 only
→ lowercase, strip punctuation and generic words (cafe, bar, co-working)
→ string similarity against the source venue name
→ above threshold AND returned address contains the requested city
→ matched, else unmatched
```

No scoring model, no candidate ranking, no fuzzy geo. At ~29 venues a week a
human can eyeball every `unmatched` row. If the miss rate is annoying, tune the
threshold — do not add machinery.

### 9.10 Access control

`3–5 staff` + `no login` + `a button that spends a Google API key` is not an
internal tool, it is an open endpoint. The risk is not secrecy; it is that
anyone holding the URL can spend the key and burn the source's tolerance for the
Vercel IP (§9.5).

v1 uses **Vercel Authentication** with scope **All Deployments** — not just
preview deployments, which is the default that leaves production open. No auth
system and no user table; access is whoever is in the Vercel team.

Stated as the exact configuration so the person deploying does not have to
guess. Confirm on deploy that the scope covers production on the current plan.
An unlisted URL alone is not sufficient.

### 9.11 Source failure is a contract, not an implementation detail

A failing dependency degrades the result; it does not fail the run:

| Meetup | Places | Result |
|---|---|---|
| ok | ok | full result |
| ok | fails | events with empty enriched columns, plus a warning |
| fails | — | explicit error, nothing invented |

Errors are returned in `errors[]` (§7.4) and shown to the user. Partial data is
far more useful than an all-or-nothing run. The prototype already behaves this
way; v1 must keep it.

### 9.12 Enrichment cost behaviour

Measured 29 unique venues across 30 events — venue repetition is low, so a cold
run enriches nearly every event. **Venue caching minimizes billable Places
lookups**, converging over time to new venues only, a handful per week.

It does not make Places free. Text Search and Place Details are billed per
request, the field mask determines the tier, and website sits above the basic
tier — part of why rating is cut (§6.4). Confirm current pricing when the key is
provisioned (§10.2); do not assume a free allowance.

### 9.13 Caching is deferred, and the venue cache is not optional later

**No cache in v1.** A scrape takes 2–4 seconds and the whole team is 3–5 people,
so a query cache buys nothing a user would notice, while costing a storage
add-on and an invalidation bug surface. Ship without it.

The two caches are not the same decision, and the difference matters:

| Cache | Purpose | When | Key | TTL |
|---|---|---|---|---|
| **Venue enrichment** | **cost control** — every miss is a billable Places call | **with milestone 7, not after** | Places `place_id` | 7d |
| Failed enrichment | stops a transient miss re-billing on every run | with milestone 7 | normalized venue name + city | 1h |
| Query result | speed only | later, if anyone asks | `city + from + to + parserVersion` | 6h |

Venue repetition is low (§9.12), so a cold run enriches nearly every event.
Shipping Places without the venue cache means re-paying for the same venues
every single run. That is why it moves into milestone 7 rather than trailing it.

The query cache stays deferred. If it is ever added, `parserVersion` belongs in
the key so a parser fix invalidates stale results instead of waiting them out.

Storage, when needed, is Redis via the Vercel Marketplace — Vercel KV is sunset
and is not an option for a new project.

---

## 10. Open questions

1. **What does a partner actually do for One Wallet?** The brief never says.
   Three different things are called "partner": a *merchant* who accepts
   payment, a *top-up point* where cash enters the wallet, a *referrer* who
   sends users. The word "top-up" does not appear in the brief; the only hint is
   "money exchange" in the business-type list. **For Sunny.**

   This does not block the build. Milestones 1–6 are identical under all three
   definitions — the answer determines ranking and which leads matter, both out
   of scope for v1. Ask in parallel; do not wait on it.
2. Who provisions and pays for the Google Cloud project and Places key?
3. Confirm the three cities: Chiang Mai, Bangkok, Phuket.
4. Is Vercel Authentication acceptable — i.e. is everyone who needs access in
   the Vercel team — or is a shared password preferred? (§9.10)

---

## 11. Milestones

| # | Deliverable | Needs a key |
|---|---|---|
| 1 | **Vercel fetch test** per §9.5 — status, size, content marker, ×5 | no |
| 2 | Meetup parser + fixture tests against saved HTML | no |
| 3 | Normalize, filter, local-time rendering (§7.1) | no |
| 4 | Page: city, date range, Run button | no |
| 5 | CSV endpoint with BOM | no |
| 6 | **Deploy + Vercel Authentication (§9.10) — ship to Sunny here** | no |
| 7 | Places venue matching (§9.9) **+ venue cache (§9.13)** | **yes** |
| 8 | Query cache — only if someone asks (§9.13) | no |

Milestone 1 gates the rest of the design.

**Milestone 6 is the delivery point, not a checkpoint.** Milestones 2–6 produce
a deployed, protected, working site with **no external keys at all** — district,
phone and website are simply empty columns. That is a usable weekly lead list
and it should go to Sunny before milestone 7 starts, so the first feedback
arrives while Places is still a decision rather than a dependency.

Milestone 7 ships the Places call and its venue cache together. Splitting them
means paying for the same venues on every run (§9.13).

Fixtures for milestone 2 already exist: raw Meetup HTML and three cities of
normalized JSON output from the 24 Sep prototype run.

---

## 12. Prototype status

A working Python prototype exists (stdlib only, ~180 lines): fetches Meetup and
Eventbrite, normalizes, filters, dedupes, and emits JSON with a `dropped`
breakdown and per-source `errors[]`. Every measurement in §9 comes from it.

It is not in the repo. Milestone 2 is a port, not a rewrite.

**Port it; do not improve it while porting.** The parsing logic is the only part
of this project that has been tested against real pages, and the saved HTML
doubles as the test fixtures. Translate it to TypeScript, keep the structure,
keep the `dropped` counters, and make the fixtures pass first. Restructure
afterwards if there is a reason — not during, where a refactor and a translation
fail together and neither can be isolated.

Two deliberate deletions during the port, both from §6.2: the Eventbrite fetcher
and its `__SERVER_DATA__` parser. Everything else transfers as-is.

---

## 13. Changes from v0.1

| # | Change | Why |
|---|---|---|
| 1 | District is a **column, not a selector** | §9.4 — keeps Places off the critical path; filtering 12 rows to 3 is not worth a dropdown |
| 2 | Eventbrite **deferred**; Meetup only | §6.2 — removes the date-only problem and the brittlest parser, for 8/30 events |
| 3 | Local time is an **output contract** | §7.1 — a UTC export shows a 6pm meetup as 11:00 |
| 4 | `startPrecision` added to the model | §7.1 — never invent midnight for a date-only source |
| 5 | `organizerUrl` added | On 12/12 measured events, free, and the only contact path to the organizer lead |
| 6 | Organizer is the grouping key; no `partners.csv` | §7.2 — venues are 29 unique / 30 events; organizers repeat up to 3× |
| 7 | Venue match confidence rule + `venueMatch` field | §9.9 — a wrong phone is worse than a missing one |
| 8 | Deployment Protection added | §9.10 — an open Run button spends the Places key |
| 9 | Per-source degradation promoted to a contract | §9.11 — already in the prototype, undocumented |
| 10 | "keeps Places free" → "minimizes billable lookups" | §9.12 — the old wording was wrong |
| 11 | `rating` cut from enrichment and CSV | §6.4 — not a BD decision input, higher field tier |
| 12 | Cache split into query / venue / failure TTLs | §9.13 — they do not age alike |
| 13 | "74 provinces" labeled as inference | §9.1 — three cities measured, the rest inferred; conclusion kept |
| 14 | Vercel test hardened to content + repetition | §9.5 — one 200 does not disprove intermittent filtering |
| 15 | Partner definition marked non-blocking | §10.1 — it changes ranking, not milestones 1–6 |
| 16 | Deploy moved earlier (milestone 6 of 8) | The keyless build should be live and protected before Places is added |

### v0.2 → v0.2.1

| # | Change | Why |
|---|---|---|
| 17 | Vercel KV replaced by Redis via Vercel Marketplace | KV is sunset; not available to a new project |
| 18 | **No cache in v1**; venue cache moved into milestone 7 | §9.13 — a query cache buys nothing at 2–4s and 5 users, but shipping Places without a venue cache re-bills every venue every run |
| 19 | Access named exactly: Vercel Authentication, All Deployments | §9.10 — "one setting" left the production-vs-preview scope ambiguous for the deployer |
| 20 | Venue matcher pinned as deliberately dumb | §9.9 — the rule invited an entity resolver; the algorithm is now spelled out |
| 21 | `startPrecision` kept, rationale added | §7.1 — a single-member union is a free compile-time guard, not dead code |
| 22 | Milestone 6 named as the delivery point | §11 — ship the keyless version to Sunny before Places starts |
| 23 | "Port, do not improve" made explicit | §12 — a refactor tangled with a translation fails as one unisolatable change |
