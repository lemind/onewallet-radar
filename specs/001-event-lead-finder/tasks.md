# Tasks: Event-Sourced Partner Lead Finder

> **STATUS 2026-09-25 — built, deployed and public.**
> https://onewallet-radar.vercel.app — pick a city and dates, press Run, download a
> spreadsheet. No login, no API keys, no database.
>
> **Three sources live:** Meetup, Eventbrite (6 category paths), Luma.
> Live counts for a one-week window: **Chiang Mai 15, Bangkok 31, Phuket 5.**
> Bangkok over three months reaches 78.
>
> **Nothing is outstanding.** The Deployment Protection toggle and "send it to Sunny"
> both cleared; the site is open and in use.
>
> **Cut for good:** Places enrichment and everything it dragged in (Google Cloud
> project, API key, password protection, venue cache, Redis), the district column
> and district filtering, Google rating, and the query cache.
>
> **Un-cut:** Eventbrite is back and is now the largest source. It was dropped for a
> brittle `__SERVER_DATA__` parser; it now publishes a clean schema.org `ItemList`
> in a `ld+json` tag, so the reason no longer held. See Phase 8.
>
> **Do not port `prototype/scrape.py`.** It has four confirmed bugs. The TypeScript was
> written fresh against `tests/fixtures/meetup-chiang-mai.html` and fixes all four.

**Branch**: `001-event-lead-finder` | **Date**: 2026-09-24
**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [research.md](./research.md), [quickstart.md](./quickstart.md)

**Tests**: Included for the parser, filters, time handling and CSV encoding.
These are requested explicitly — the port must reproduce the prototype's
measured output, and saved HTML fixtures make that verifiable offline. No tests
are written for the UI or for glue code.

**Organization**: By user story. Phases 1-7 were the original plan; Phase 8 records
the multi-source work that followed, which the original plan did not anticipate
because it assumed Meetup would be the only viable source.

---

## Phase 1: Setup — including the architecture gate

**Nothing past T005 should be started until T004 passes.** If Meetup blocks
Vercel's datacenter IPs, the architecture changes and most of this file is
rewritten. See [research.md](./research.md) O1.

- [x] T001 Scaffold Next.js App Router app (TypeScript, Node 22) over the existing repo root, keeping `package.json` name, `.nvmrc`, `.editorconfig` and `tsconfig.json` intact
- [x] T002 Add `next`, `react`, `react-dom` to dependencies and `dev`, `build`, `start`, `test` scripts in `package.json`
- [~] T003 DROPPED 24 Sep — the real app was deployed instead, which exercises the same path. Original: create the throwaway gate route in `src/app/api/iptest/route.ts` — fetch the Meetup Chiang Mai listing with a desktop User-Agent and return `{ status, bytes, hasEventSchema, elapsedMs }`, where `hasEventSchema` tests for `"@type":"Event"` in the body
- [~] T004 DROPPED 24 Sep on request. The IP question is answered by the live deployment rather than a probe route. Original: **GATE** deploy with `vercel deploy` and call `/api/iptest` 5 times in immediate succession; record every result in [research.md](./research.md) under O1. Pass requires status 200, plausible byte count and `hasEventSchema: true` on **every** attempt. Any failure stops the build and moves the fetch to a scheduled GitHub Action per [plan.md](./plan.md) Phase 1
- [~] T005 N/A — no iptest route was ever created (T003 dropped)

**Checkpoint**: The architecture is proven. Everything below is safe to build.

---

## Phase 2: Foundational — blocking prerequisites

These are shared by every user story and must complete before Phase 3.

- [x] T006 [P] Define `Event`, `RunResult`, `DroppedCounts`, `SourceError`, `VenueMatch` and `CityId` in `src/types.ts`, matching [data-model.md](./data-model.md) exactly
- [x] T007 [P] Define the three supported cities with their Meetup slugs (`th--Chiang-Mai`, `th--Bangkok`, `th--Phuket`) in `src/lib/cities.ts`
- [x] T008 [P] Commit the 24 Sep prototype run into the repo — `tests/fixtures/meetup-chiang-mai.html` (the raw listing the tests parse), `prototype/scrape.py` (the proven parser T011 and T014 port) and `prototype/chiang-mai.expected.json` (its output, the baseline the port must reproduce)
- [x] T009 Implement `src/lib/time.ts` — parse a published instant into `startUtc`, derive `startLocal` in `Asia/Bangkok` via a named zone, and carry `startPrecision`
- [x] T010 Write `tests/time.test.ts` asserting `2026-09-24T11:00:00.000Z` renders as `2026-09-24 18:00`, that a date-only input yields an empty time cell rather than `00:00`, and that `startUtc` is never mutated

**Checkpoint**: Types, cities and time handling exist and are tested.

---

## Phase 3: User Story 1 — Get this week's leads for a city (P1) 🎯 MVP

**Goal**: A team member picks a city and a date range, presses Run, sees the
week's events with venue and organizer, and downloads a spreadsheet.

**Independent test**: Select Chiang Mai and a 7-day range, press Run, confirm a
CSV downloads containing that week's events with a venue and an organizer per
row, readable in Excel with Thai characters intact.

### Parser — port, do not improve

- [x] T011 [US1] Implement `src/lib/meetup.ts` — fetch the city listing with a desktop User-Agent, handle gzip, extract `application/ld+json` blocks and keep records where `@type === "Event"`. A direct translation of the prototype; keep its structure
- [x] T012 [US1] Extract `organizer.name` **and** `organizer.url` in `src/lib/meetup.ts` — the prototype discards the URL, and it is the only contact path to the organizer lead
- [x] T013 [P] [US1] Write `tests/meetup.test.ts` against `tests/fixtures/meetup-chiang-mai.html` asserting 12 events parsed, 12 with an organizer name and 12 with an organizer URL

### Normalize and filter

- [x] T014 [US1] Implement `src/lib/normalize.ts` — flatten `location.address` into a single string, lift venue and organizer, normalize an empty-string `endDate` to `null`, and map each record to `Event` with `venueMatch: "not_attempted"`
- [x] T015 [US1] Implement the five filter rules and their counters in `src/lib/normalize.ts` per [data-model.md](./data-model.md) — online, no-venue, no-date, out-of-range, duplicate `(source, url)` — then sort by `startUtc` ascending
- [x] T016 [P] [US1] Write `tests/normalize.test.ts` against a **fixed injected `now`**, not wall-clock time, or the fixture's out-of-range count drifts every day. Re-derive the expected dropped counts from the fixture at that fixed instant; the prototype's 18 online / 0 no-venue / 0 no-date / 3 out-of-range / 3 duplicate was measured **with** the 12-hour grace that T015 no longer applies

### Endpoint and page

- [x] T017 [US1] Implement `src/app/api/run/route.ts` per [contracts/run.md](./contracts/run.md) — validate `city`, `from` and `to`, return 400 on bad input, 502 when Meetup is unreachable, and a `RunResult` on success with a 25-second fetch timeout
- [x] T018 [US1] Build the single page in `src/app/page.tsx` — city select, date range inputs, Run button, and a results table showing name, local start, venue, organizer and source link
- [x] T019 [US1] Add a loading state to `src/app/page.tsx` so a 2–4 second fetch does not look like a dead button

### CSV export

- [x] T020 [P] [US1] Implement `src/lib/csv.ts` per [contracts/export.md](./contracts/export.md) — UTF-8 BOM prefix, the fixed 11-column order, `YYYY-MM-DD HH:MM` start formatting, empty cells for nulls, `\r\n` line endings, and quote-escaping for fields containing commas or quotes
- [x] T021 [P] [US1] Write `tests/csv.test.ts` asserting the output begins with bytes `EF BB BF`, that a Thai venue name survives a round trip, that a comma-containing address is quoted, and that the header is emitted for an empty result set
- [x] T023 [US1] Wire a download button into `src/app/page.tsx` that builds the CSV **in the browser** from the `RunResult` already held in state and saves it via a Blob URL — no second request, no second scrape. `src/lib/csv.ts` must therefore stay browser-safe: no `Buffer`, no `fs`, and the UTF-8 BOM prepended as a `\uFEFF` string

**Checkpoint**: The MVP works locally. A person can run a search and get a
usable spreadsheet. This alone delivers the product's core value.

---

## Phase 4: User Story 2 — Trust each lead before acting on it (P2)

**Goal**: Every row is traceable to its source, and nothing unverified is
presented as fact.

**Independent test**: Open any row's source link and reach the original listing.
Force an unverifiable venue and confirm the contact columns are empty and the
row is marked unverified, rather than filled with a near-match.

- [x] T024 [US2] Render each row's source link as a visible, clickable element in `src/app/page.tsx`, never a bare URL string
- [~] T025 BLOCKED — `venueMatch` does not exist until Places lands in Phase 6. Original: display the `venueMatch` state per row in `src/app/page.tsx` so verified and unverified rows are distinguishable at a glance
- [x] T027 [US2] Distinguish the three outcomes in `src/app/page.tsx` — results, an explicit "no events in this range" empty state naming the city and dates, and a fetch failure — per FR-021
- [x] T028 [US2] Surface `errors[]` as a warning banner in `src/app/page.tsx` when non-empty alongside results — amber `.note.warn`, names the failing source and its message; verified served
- [x] T029 [P] [US2] Render a single line above the table — `Showing N of M found` — from `dropped`. One line of text, not a panel: roughly half of raw results are filtered, and this answers the first question anyone asks when the list looks short

**Checkpoint**: The output is safe to act on. Nothing is guessed, and every
claim is checkable.

---

## Phase 5: Ship it 🚢 DELIVERY POINT

**Goal**: Deployed and in Sunny's hands — no API keys, no login.

**Independent test**: Open the production URL in a fresh browser and run a
search without signing in to anything.

**No authentication.** This is an internal tool whose only capability at this
point is scraping a public listing page. There is no key, no spend and no
written data, so there is nothing to protect and a login would only stand
between Sunny and the thing we want feedback on. Protection returns in Phase 6,
where it is a cost control rather than a security measure — see T032.

- [~] T031 Deploy to production with `vercel --prod` — **deployed, but Vercel Deployment Protection is on by default and returns 302.** Turn it off in the dashboard (Settings → Deployment Protection → Vercel Authentication → Disabled). Cannot be done from the CLI: the CLI token is not API-scoped
- [x] T034 [P] Phone width — added a `max-width: 480px` block stacking the form controls full-width; viewport meta present, table already scrolls in its own container; verified in the served CSS bundle
- [~] T035 BLOCKED — Vercel Deployment Protection returns 302; needs the dashboard toggle. Original: **send the URL to Sunny** — no account needed, no password to pass on. Feedback should arrive while Places is still a decision rather than a dependency

**Checkpoint**: A working tool is in use. Everything below improves a product
that already exists.

---

## Phase 6: ~~Contact details attached to each lead~~ — CUT 24 Sep

**Cut, not deferred to a date.** The brief asked for business name, phone and
address. Measured against the committed fixture, Meetup already supplies
**venue name 10/12, street address 10/12, organizer 12/12, organizer URL
12/12** — for free, with no key. Google Places would have added exactly one
field: the phone number.

The price of that one field: a Google Cloud project with billing enabled (the
only way a Places key can exist), a key to restrict and protect, password
protection on the deployment because a public Run button would then spend money,
a venue cache so repeat runs do not re-bill, and the wrong-business matching risk
that T037 existed to contain — a confidently wrong phone number is worse than no
phone number, since the output drives calls to real businesses.

A BD user holding the business name, the street address and a link to the event
page can find a phone number in seconds, and is calling a human regardless.

**Revisit when there is evidence, not before**: if the team uses the tool for a
week and asks for phone numbers, that is the signal. The design slots back in
cleanly behind a `venueMatch` flag — the tasks below are kept as the record of
how, not as work to schedule.

- [~] T036 CUT 24 Sep — see the Phase 6 header. Original: Implement `src/lib/places.ts` — Text Search with an explicit field mask limited to **name, phone and address**. No `rating`, no district: a phone number is what makes a lead actionable, and district was cut with the filter it existed for
- [~] T037 CUT 24 Sep — see the Phase 6 header. Original: Implement the match confidence gate in `src/lib/places.ts` — candidate #1 only, normalize names by lowercasing and stripping punctuation and generic words, then accept **only** an exact match of the normalized strings with the returned address containing the requested city. Anything else is `unmatched`. No similarity score, no threshold, no fuzzy matcher — a wrong business is worse than a missing one
- [~] T038 CUT 24 Sep — see the Phase 6 header. Original: Set `venueMatch` to `"matched"` or `"unmatched"` in `src/lib/places.ts`, attaching all three fields or none — never a partial fill
- [~] T026 CUT 24 Sep — see the Phase 6 header. Original: Enforce the all-or-nothing invariant at the **enrichment boundary** in `src/lib/places.ts` — `venueMatch !== "matched"` must always produce null `district`, `phone` and `website`. It cannot live in `normalize.ts`: those fields do not exist until this phase
- [~] T039 CUT 24 Sep — see the Phase 6 header. Original: Implement `src/lib/cache.ts` — venue cache keyed by `{city}:{normalizedVenueName}` — **not** `place_id`, which is unknown until after the very lookup the cache exists to avoid — storing `{ placeId, district, phone, website }` with a 7-day TTL, and a separate failed-lookup cache keyed by normalized venue name plus city with a 1-hour TTL, backed by Redis from the Vercel Marketplace
- [~] T040 CUT 24 Sep — see the Phase 6 header. Original: Wire enrichment into `src/app/api/run/route.ts` — deduplicate venues before lookup (29 unique per 30 events), check the cache before any request, run lookups concurrently, and append to `errors[]` on failure **without** discarding events
- [~] T032 CUT 24 Sep — see the Phase 6 header. Original: **Before the key goes in**, put the deployment behind Vercel Password Protection — one shared password, no accounts for Sunny to create. From here a public URL is a billing risk, not just an open page. If password protection is not available on the current plan, cap spend instead: a per-run venue-lookup limit plus a Google Cloud budget alert
- [~] T041 CUT 24 Sep — see the Phase 6 header. Original: Add `GOOGLE_PLACES_API_KEY` and `REDIS_URL` to the Vercel project, restricting the key by API in Google Cloud
- [~] T042 CUT 24 Sep — see the Phase 6 header. Original: Verify per [quickstart.md](./quickstart.md) — unverified rows carry empty contact columns, a repeat search triggers no new billable lookups, and removing the key still returns events with a warning

**Checkpoint**: Leads are directly workable and sortable by district.

---

## Phase 7: Polish

- [x] T043 [P] Rewrote `README.md` — documents the working MVP, live coverage for all three cities, and the four things easy to get wrong (UTC, BOM, district, online noise)
- [~] T044 N/A — T004 was dropped, so there are no probe results to record. The live deployment supersedes it in [research.md](./research.md) O1, replacing the open status
- [x] T045 [P] Copy pass — "Scraping…" → "Searching…", subtitle rewritten, organizer spelling made consistent with the CSV column; empty state already named the city and date range
- [x] T046 Confirm no `startUtc` value reaches any user-facing surface — page or CSV

---

## Dependencies

```
Phase 1 (Setup + GATE)
   │  T004 must pass — an architecture gate, not a task
   ▼
Phase 2 (Foundational)  ← blocks everything
   ▼
Phase 3 (US1, P1)  ← MVP, delivers core value alone
   ▼
Phase 4 (US2, P2)  ← depends on US1's page and pipeline
   ▼
Phase 5 (Ship it)  ← DELIVERY POINT, ship here — no key, no login
   ▼
Phase 6 (US3, P3)  ← additive; needs the key
   ▼
Phase 7 (Polish)
```

**Story independence**: US1 stands alone. US2 refines US1's output and page, so
it follows rather than parallels it. US3 is fully additive: remove it and every
other story still works, with three columns empty. US4 is not independent at
all — it is triggered by US3, since protection becomes necessary at the moment a
Run starts costing money and not before.

---

## Parallel execution

Tasks marked `[P]` touch different files and have no incomplete dependencies.

**Phase 2**: T006, T007 and T008 together — types, cities and fixtures are
unrelated files.

**Phase 3**: T013, T016, T020 and T021 together once their subjects exist —
parser tests, filter tests and the CSV module are independent.

**Phase 4**: T029 is the only parallelizable task.

**Phase 7**: T043, T044 and T045 together.

Most of Phase 6 is sequential: T037 depends on T036, T038 on T037, T040 on all
three.

---

## Implementation strategy

**MVP is Phase 1 + 2 + 3.** That is a working local tool producing the
spreadsheet the team needs. If the hackathon clock runs out there, something
real has still been built.

**Ship at Phase 5, not at Phase 6.** The tool is deliverable without enrichment,
and at that point it is also deliverable without a login: a Run fetches one
public listing page that anyone could open directly, so it spends nothing and
writes nothing. Getting it to Sunny before Places starts means the first real
feedback arrives while enrichment is still a choice. Protection arrives in
Phase 6 with the key (T032), where it is cost control rather than security.

**Phase 1 is a gate, not a warm-up.** T004 is the only task here that can
invalidate the rest of the plan. Run it first, run it repeatedly, and believe
the result.

**Port; do not improve.** T011 and T014 translate proven Python. The fixture
assertions in T013 and T016 are the definition of correct — any divergence is a
porting bug, not a better idea. Restructure afterwards if there is a reason.

---

## Task summary

| Phase | Story | Tasks | Count |
|---|---|---|---|
| 1 Setup + gate | — | T001–T005 | 5 |
| 2 Foundational | — | T006–T010 | 5 |
| 3 Get this week's leads | US1 (P1) | T011–T023 (no T022) | 12 |
| 4 Trust each lead | US2 (P2) | T024–T029 (no T026, T030) | 5 |
| 5 Ship it | — | T031, T034, T035 | 3 |
| 6 Contact details | US3 (P3) | T036–T042 + T026, T032 | 9 |
| 7 Polish | — | T043–T046 | 4 |
| **Total** | | | **43** |

Parallel opportunities: 12 tasks marked `[P]`.
Tasks requiring an API key: 7 — every Phase 6 task except T026.

---

## Phase 8: More sources — done 24-25 Sep

Added after the first real use of the tool showed the honest problem was not
enrichment but **volume**: one source per city returned around 10 leads a week.

- [x] T047 Re-evaluate Eventbrite against the live site — found it now publishes a schema.org `ItemList` in a `ld+json` tag, not the internal `__SERVER_DATA__` blob that got it deferred; the objection was stale
- [x] T048 Restore `startPrecision` in `src/lib/time.ts` and `src/types.ts` — Eventbrite publishes bare dates, so a date-only event renders as a date with no time rather than a fabricated midnight
- [x] T049 Keep a date-only event for its whole day in `src/lib/normalize.ts`, or a same-day listing disappears one minute past midnight
- [x] T050 Unify extraction in `src/lib/ldjson.ts` — one parser handling both direct `Event` nodes (Meetup) and `ItemList` wrappers (Eventbrite, Luma), replacing the per-source files
- [x] T051 Add Luma as a third source — same `ItemList` shape, carries organizers and real timestamps. Bangkok only: Chiang Mai and Phuket redirect to `/discover`, so those cities are simply absent from its config
- [x] T052 Fetch six Eventbrite category paths per city in `src/lib/sources.ts`, not just the base listing — measured +5 unique events for Chiang Mai. Pagination was tested and rejected: `?page=2` adds 3, `?page=3` adds 0
- [x] T053 Extend per-source degradation to three sources in `src/app/api/run/route.ts` — `Promise.allSettled`, one source failing never discards the others, only a total failure returns 502
- [x] T054 Show the address under the venue name and a source column in `src/app/page.tsx`
- [x] T055 Remove `src/lib/meetup.ts` and `src/lib/eventbrite.ts`, superseded by `ldjson.ts`

**Checkpoint met**: Bangkok went 11 → 31 for a one-week window, Chiang Mai 11 → 15.
12 tests pass, typecheck and build clean, verified in production.

### Measured ceiling, so nobody chases it again

Chiang Mai over **three months** returns 15 with `outOfRange: 0` — nothing is being
filtered for dates. That is the entire supply across all three sources for the rest
of the year, not a limit in the code. There is no cap, no `slice`, no page cutoff.

Reaching 100 for Chiang Mai needs Thai-language sources (Facebook Events, Thai
ticketing sites), which are JavaScript-rendered and need a rendering scraper such
as Firecrawl or Playwright. Roughly half a day, and the only route to those numbers.
Bangkok already passes 78 over three months without it.
