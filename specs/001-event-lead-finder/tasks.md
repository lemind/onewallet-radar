# Tasks: Event-Sourced Partner Lead Finder

**Branch**: `001-event-lead-finder` | **Date**: 2026-09-24
**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [research.md](./research.md), [quickstart.md](./quickstart.md)

**Tests**: Included for the parser, filters, time handling and CSV encoding.
These are requested explicitly — the port must reproduce the prototype's
measured output, and saved HTML fixtures make that verifiable offline. No tests
are written for the UI or for glue code.

**Organization**: By user story, so each is independently implementable and
testable. Stories are ordered by priority; **US4 ships before US3** because the
tool is deliverable without enrichment but not without access control.

---

## Phase 1: Setup — including the architecture gate

**Nothing past T005 should be started until T004 passes.** If Meetup blocks
Vercel's datacenter IPs, the architecture changes and most of this file is
rewritten. See [research.md](./research.md) O1.

- [ ] T001 Scaffold Next.js App Router app (TypeScript, Node 22) over the existing repo root, keeping `package.json` name, `.nvmrc`, `.editorconfig` and `tsconfig.json` intact
- [ ] T002 Add `next`, `react`, `react-dom` to dependencies and `dev`, `build`, `start`, `test` scripts in `package.json`
- [ ] T003 Create the throwaway gate route in `src/app/api/iptest/route.ts` — fetch the Meetup Chiang Mai listing with a desktop User-Agent and return `{ status, bytes, hasEventSchema, elapsedMs }`, where `hasEventSchema` tests for `"@type":"Event"` in the body
- [ ] T004 **GATE** Deploy with `vercel deploy` and call `/api/iptest` 3–5 times over at least an hour; record every result in [research.md](./research.md) under O1. Pass requires status 200, plausible byte count and `hasEventSchema: true` on **every** attempt. Any failure stops the build and moves the fetch to a scheduled GitHub Action per [plan.md](./plan.md) Phase 1
- [ ] T005 Delete `src/app/api/iptest/route.ts` once T004 has passed

**Checkpoint**: The architecture is proven. Everything below is safe to build.

---

## Phase 2: Foundational — blocking prerequisites

These are shared by every user story and must complete before Phase 3.

- [ ] T006 [P] Define `Event`, `RunResult`, `DroppedCounts`, `SourceError`, `VenueMatch` and `CityId` in `src/types.ts`, matching [data-model.md](./data-model.md) exactly
- [ ] T007 [P] Define the three supported cities with their Meetup slugs (`th--Chiang-Mai`, `th--Bangkok`, `th--Phuket`) in `src/lib/cities.ts`
- [ ] T008 [P] Copy the prototype's saved Meetup HTML to `tests/fixtures/meetup-chiang-mai.html` and its normalized output to `tests/fixtures/expected-chiang-mai.json`, both from the 24 Sep run in the prototype scratchpad
- [ ] T009 Implement `src/lib/time.ts` — parse a published instant into `startUtc`, derive `startLocal` in `Asia/Bangkok` via a named zone, and carry `startPrecision`
- [ ] T010 Write `tests/time.test.ts` asserting `2026-09-24T11:00:00.000Z` renders as `2026-09-24 18:00`, that a date-only input yields an empty time cell rather than `00:00`, and that `startUtc` is never mutated

**Checkpoint**: Types, cities and time handling exist and are tested.

---

## Phase 3: User Story 1 — Get this week's leads for a city (P1) 🎯 MVP

**Goal**: A team member picks a city and a date range, presses Run, sees the
week's events with venue and organizer, and downloads a spreadsheet.

**Independent test**: Select Chiang Mai and a 7-day range, press Run, confirm a
CSV downloads containing that week's events with a venue and an organizer per
row, readable in Excel with Thai characters intact.

### Parser — port, do not improve

- [ ] T011 [US1] Implement `src/lib/meetup.ts` — fetch the city listing with a desktop User-Agent, handle gzip, extract `application/ld+json` blocks and keep records where `@type === "Event"`. A direct translation of the prototype; keep its structure
- [ ] T012 [US1] Extract `organizer.name` **and** `organizer.url` in `src/lib/meetup.ts` — the prototype discards the URL, and it is the only contact path to the organizer lead
- [ ] T013 [P] [US1] Write `tests/meetup.test.ts` against `tests/fixtures/meetup-chiang-mai.html` asserting 12 events parsed, 12 with an organizer name and 12 with an organizer URL

### Normalize and filter

- [ ] T014 [US1] Implement `src/lib/normalize.ts` — flatten `location.address` into a single string, lift venue and organizer, normalize an empty-string `endDate` to `null`, and map each record to `Event` with `venueMatch: "not_attempted"`
- [ ] T015 [US1] Implement the five filter rules and their counters in `src/lib/normalize.ts` per [data-model.md](./data-model.md) — online, no-venue, no-date, out-of-range (with a 12-hour backward grace), duplicate `(source, url)` — then sort by `startUtc` ascending
- [ ] T016 [P] [US1] Write `tests/normalize.test.ts` asserting the Chiang Mai fixture yields 12 kept events and dropped counts of 18 online / 0 no-venue / 0 no-date / 3 out-of-range / 3 duplicate

### Endpoint and page

- [ ] T017 [US1] Implement `src/app/api/run/route.ts` per [contracts/run.md](./contracts/run.md) — validate `city`, `from` and `to`, return 400 on bad input, 502 when Meetup is unreachable, and a `RunResult` on success with a 25-second fetch timeout
- [ ] T018 [US1] Build the single page in `src/app/page.tsx` — city select, date range inputs, Run button, and a results table showing name, local start, venue, organizer and source link
- [ ] T019 [US1] Add a loading state to `src/app/page.tsx` so a 2–4 second fetch does not look like a dead button

### CSV export

- [ ] T020 [P] [US1] Implement `src/lib/csv.ts` per [contracts/export.md](./contracts/export.md) — UTF-8 BOM prefix, the fixed 11-column order, `YYYY-MM-DD HH:MM` start formatting, empty cells for nulls, `\r\n` line endings, and quote-escaping for fields containing commas or quotes
- [ ] T021 [P] [US1] Write `tests/csv.test.ts` asserting the output begins with bytes `EF BB BF`, that a Thai venue name survives a round trip, that a comma-containing address is quoted, and that the header is emitted for an empty result set
- [ ] T022 [US1] Implement `src/app/api/export.csv/route.ts` — same pipeline and parameters as `/api/run`, returning `text/csv` with a `Content-Disposition` filename, and **JSON** rather than CSV on 400 and 502
- [ ] T023 [US1] Wire a download button into `src/app/page.tsx` that calls the export endpoint with the current selection

**Checkpoint**: The MVP works locally. A person can run a search and get a
usable spreadsheet. This alone delivers the product's core value.

---

## Phase 4: User Story 2 — Trust each lead before acting on it (P2)

**Goal**: Every row is traceable to its source, and nothing unverified is
presented as fact.

**Independent test**: Open any row's source link and reach the original listing.
Force an unverifiable venue and confirm the contact columns are empty and the
row is marked unverified, rather than filled with a near-match.

- [ ] T024 [US2] Render each row's source link as a visible, clickable element in `src/app/page.tsx`, never a bare URL string
- [ ] T025 [US2] Display the `venueMatch` state per row in `src/app/page.tsx` so verified and unverified rows are distinguishable at a glance
- [ ] T026 [US2] Enforce the all-or-nothing invariant in `src/lib/normalize.ts` — assert that `venueMatch !== "matched"` implies `district`, `phone` and `website` are all null, so a future change cannot partially fill a row
- [ ] T027 [US2] Distinguish the three outcomes in `src/app/page.tsx` — results, an explicit "no events in this range" empty state naming the city and dates, and a fetch failure — per FR-021
- [ ] T028 [US2] Surface `errors[]` as a visible warning banner in `src/app/page.tsx` whenever it is non-empty alongside populated results
- [ ] T029 [P] [US2] Display `dropped` counts somewhere unobtrusive in `src/app/page.tsx`, so a filter that starts misbehaving is noticeable
- [ ] T030 [P] [US2] Add a `tests/csv.test.ts` case asserting a date-only event exports an empty time cell and never `00:00`

**Checkpoint**: The output is safe to act on. Nothing is guessed, and every
claim is checkable.

---

## Phase 5: User Story 4 — Only the team can run it (P2) 🚢 DELIVERY POINT

**Goal**: Deployed, protected, and in Sunny's hands — with no API keys involved.

**Independent test**: Open the production URL signed out of the team account and
confirm access is refused before any search can run.

- [ ] T031 [US4] Deploy to production with `vercel --prod`
- [ ] T032 [US4] Enable Vercel Authentication with scope **All Deployments** — not the preview-only default, which would leave production open
- [ ] T033 [US4] Verify in a signed-out private window that the production URL refuses access before any search runs, and that a team member reaches the page without a separate password
- [ ] T034 [P] [US4] Confirm the page is usable at phone width, since the brief requires phone and laptop
- [ ] T035 [US4] **Send the URL to Sunny.** Feedback should arrive while Places is still a decision rather than a dependency

**Checkpoint**: A working, protected tool is in use. Everything below improves a
product that already exists.

---

## Phase 6: User Story 3 — Contact details attached to each lead (P3)

**Goal**: District, phone and website populate for confidently matched venues.

**Independent test**: Run a Chiang Mai search with enrichment enabled; matched
venues carry contact details, unverified ones carry none, and a repeat run
triggers no new billable lookups.

**This phase is the only one requiring a paid API key.**

- [ ] T036 [US3] Implement `src/lib/places.ts` — Text Search with an explicit field mask limited to district, phone and website, then Place Details only where required. **No `rating` field**, per [research.md](./research.md) D4
- [ ] T037 [US3] Implement the match confidence gate in `src/lib/places.ts` — candidate #1 only, normalize names by lowercasing and stripping punctuation and generic words, apply a similarity threshold, and require the returned address to contain the requested city. Keep it dumb; this is not entity resolution
- [ ] T038 [US3] Set `venueMatch` to `"matched"` or `"unmatched"` in `src/lib/places.ts`, attaching all three fields or none — never a partial fill
- [ ] T039 [US3] Implement `src/lib/cache.ts` — venue cache keyed by `place_id` with a 7-day TTL, and a separate failed-lookup cache keyed by normalized venue name plus city with a 1-hour TTL, backed by Redis from the Vercel Marketplace
- [ ] T040 [US3] Wire enrichment into `src/app/api/run/route.ts` — deduplicate venues before lookup (29 unique per 30 events), check the cache before any request, run lookups concurrently, and append to `errors[]` on failure **without** discarding events
- [ ] T041 [US3] Add `GOOGLE_PLACES_API_KEY` and `REDIS_URL` to the Vercel project, restricting the key by API in Google Cloud
- [ ] T042 [US3] Verify per [quickstart.md](./quickstart.md) — unverified rows carry empty contact columns, a repeat search triggers no new billable lookups, and removing the key still returns events with a warning

**Checkpoint**: Leads are directly workable and sortable by district.

---

## Phase 7: Polish

- [ ] T043 [P] Rewrite `README.md` — it still describes a GitHub Actions cron, Eventbrite as a live source, and "No API keys required", all of which now contradict the spec
- [ ] T044 [P] Record the measured Vercel fetch results from T004 in [research.md](./research.md) O1, replacing the open status
- [ ] T045 [P] Check the empty-state and error copy reads plainly for a non-technical BD user
- [ ] T046 Confirm no `startUtc` value reaches any user-facing surface — page or CSV

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
Phase 5 (US4, P2)  ← DELIVERY POINT, ship here
   ▼
Phase 6 (US3, P3)  ← additive; needs the key
   ▼
Phase 7 (Polish)
```

**Story independence**: US1 stands alone. US2 refines US1's output and page, so
it follows rather than parallels it. US4 depends only on something being
deployable — it could run any time after Phase 3. US3 is fully additive: remove
it and every other story still works, with three columns empty.

---

## Parallel execution

Tasks marked `[P]` touch different files and have no incomplete dependencies.

**Phase 2**: T006, T007 and T008 together — types, cities and fixtures are
unrelated files.

**Phase 3**: T013, T016, T020 and T021 together once their subjects exist —
parser tests, filter tests and the CSV module are independent.

**Phase 4**: T029 and T030 together.

**Phase 7**: T043, T044 and T045 together.

Most of Phase 6 is sequential: T037 depends on T036, T038 on T037, T040 on all
three.

---

## Implementation strategy

**MVP is Phase 1 + 2 + 3.** That is a working local tool producing the
spreadsheet the team needs. If the hackathon clock runs out there, something
real has still been built.

**Ship at Phase 5, not at Phase 6.** The tool is deliverable without enrichment;
it is not deliverable without access control, because an open Run button spends
a key and burns the source's tolerance for the IP. Getting it in front of Sunny
before Places starts means the first real feedback arrives while enrichment is
still a choice.

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
| 3 Get this week's leads | US1 (P1) | T011–T023 | 13 |
| 4 Trust each lead | US2 (P2) | T024–T030 | 7 |
| 5 Only the team can run it | US4 (P2) | T031–T035 | 5 |
| 6 Contact details | US3 (P3) | T036–T042 | 7 |
| 7 Polish | — | T043–T046 | 4 |
| **Total** | | | **46** |

Parallel opportunities: 13 tasks marked `[P]`.
Tasks requiring an API key: 7 (all in Phase 6).
