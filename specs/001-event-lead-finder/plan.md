# Implementation Plan: Event-Sourced Partner Lead Finder

**Branch**: `001-event-lead-finder` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-event-lead-finder/spec.md`

## Summary

A single-page internal web tool. The user picks a city and a date range and
presses Run; a server-side route fetches the Meetup listing page for that city,
extracts the `application/ld+json` event blocks embedded in the raw HTML,
normalizes and filters them, optionally enriches each venue through Google
Places, and returns rows that the page renders and offers as a CSV download.

The approach is deliberately small: one Next.js app on Vercel, no database, no
headless browser, no queue, no background jobs. Parsing logic is a port of a
proven Python prototype rather than a fresh implementation.

The plan is sequenced so that a **deployed, useful tool exists before any paid
API is involved**. Google Places is additive — until it lands, district, phone
and website are simply empty columns, and there is nothing to protect because a
Run spends nothing.

## Technical Context

**Language/Version**: TypeScript 5.7, Node 22 (`.nvmrc` pins it)

**Primary Dependencies**: Next.js (App Router) — plus native `fetch` and the
standard library. No scraping framework, no HTML parser library, no CSV library;
each would be more code to configure than to write.

**Storage**: None in v1. A venue cache arrives with Places in Phase 7, backed by
Redis via the Vercel Marketplace. Vercel KV is sunset and is not an option.

**Testing**: `node --test` with the saved prototype HTML as fixtures. The parser
is the only component with non-obvious logic and is the only one that needs unit
tests. Fixtures make those tests run offline and deterministically.

**Target Platform**: Vercel serverless functions, `iad1` or nearest region;
modern browsers, phone and laptop.

**Project Type**: Web application, single deployment (no separate backend).

**Performance Goals**: A cold run returns in under 10 seconds; the measured
prototype scrape is 2–4 seconds and Places enrichment adds roughly one lookup
per venue, parallelized.

**Constraints**:
- Every event row must carry a source URL (FR-009)
- No fabricated data: unverified venues carry empty contact fields (FR-012)
- All times rendered in `Asia/Bangkok` (FR-014)
- CSV must be UTF-8 **with BOM** or Excel corrupts Thai text (FR-017)
- Enrichment failure must not fail the run (FR-019)

**Scale/Scope**: 3–5 internal users, 3 cities, 10–15 events per city per week,
roughly 29 unique venues per 30 events. Single-digit runs per day. This is small
enough that most conventional scaling concerns simply do not apply, and the plan
should not pretend otherwise.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**`.specify/memory/constitution.md` is an unfilled template.** `/speckit-constitution`
has not been run for this project, so there are no ratified principles to gate
against. Rather than invent them, this plan is gated against the constraints
already approved in `SPEC.md` v0.2.1, which serve the same purpose:

| Gate | Source | Status |
|---|---|---|
| No paid API on the critical path of the main button | §9.4 | **Pass** — district is a column; Phases 1–6 use no key |
| Never present unverified data as verified | §9.9 | **Pass** — `venueMatch` is explicit, enrichment is all-or-nothing |
| Never fabricate a timestamp | §7.1 | **Pass** — `startPrecision` carried through; UTC stored, local rendered |
| Degrade, do not fail | §9.11 | **Pass** — `errors[]` in the envelope; enrichment is independent of fetch |
| No premature infrastructure | §9.13 | **Pass** — no cache, no DB in v1; venue cache only when it controls cost |
| Port the proven parser; do not rewrite it | §12 | **Pass** — Phase 2 is a translation with fixtures |

**Post-Phase-1 re-check**: still passing. The design adds no storage, no
background processing and no third dependency; `contracts/run.md` keeps the
failure envelope explicit rather than letting errors collapse into a 500.

Running `/speckit-constitution` would be worthwhile if this project outlives the
hackathon. It is not a blocker now.

## Project Structure

### Documentation (this feature)

```text
specs/001-event-lead-finder/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 — decisions and rejected alternatives
├── data-model.md        # Phase 1 — entities and transformation pipeline
├── quickstart.md        # Phase 1 — how to run and verify it
├── contracts/
│   ├── run.md           # GET /api/run — the only data endpoint
│   └── export.md        # GET /api/export.csv — the download
├── checklists/
│   └── requirements.md  # Spec quality validation
└── tasks.md             # Phase 2 — created by /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── page.tsx                 # The single page: city, date range, Run, results
│   ├── layout.tsx
│   └── api/
│       ├── run/route.ts         # Orchestrates fetch → normalize → filter → enrich
│       ├── export.csv/route.ts  # Same pipeline, CSV response
│       └── iptest/route.ts      # Phase 1 only — deleted after the gate passes
├── lib/
│   ├── meetup.ts                # Fetch + JSON-LD extraction (port of scrape.py)
│   ├── normalize.ts             # Raw JSON-LD → Event; filter rules; dedupe
│   ├── time.ts                  # UTC storage, Asia/Bangkok rendering, precision
│   ├── places.ts                # Text Search → Details, match confidence
│   ├── cache.ts                 # Venue cache (Phase 7); no-op before that
│   ├── csv.ts                   # BOM, escaping, column order
│   └── cities.ts                # The three cities and their source slugs
└── types.ts                     # Event, RunResult, VenueMatch

tests/
├── fixtures/
│   ├── meetup-chiang-mai.html   # Saved 24 Sep, from the prototype run
│   └── expected-chiang-mai.json # Prototype output, the port must reproduce it
├── meetup.test.ts               # Parser against fixtures
├── normalize.test.ts            # Filter rules, dedupe, range boundaries
├── time.test.ts                 # Timezone rendering, date-only handling
└── csv.test.ts                  # BOM, Thai text, escaping
```

**Structure decision**: Option 1 (single project), not the web-application split.
Next.js route handlers are the backend; a separate `backend/` and `frontend/`
tree would add directories without adding a boundary. All non-trivial logic
lives in `src/lib/` as plain functions taking data and returning data, so it is
testable without booting Next.js or touching the network.

## Phase 0 — Research

See [research.md](./research.md). Every open technical question was resolved
against the prototype's measurements rather than left as NEEDS CLARIFICATION.
One genuine unknown remains and is the first thing built: **whether Meetup
serves Vercel's datacenter IPs at all.**

## Phase 1 — Design

- [data-model.md](./data-model.md) — `Event`, `RunResult`, `VenueMatch`, and the
  transformation pipeline from raw JSON-LD to CSV row
- [contracts/run.md](./contracts/run.md) — the single data endpoint, including
  its partial-success shape
- [contracts/export.md](./contracts/export.md) — CSV encoding, column order, BOM
- [quickstart.md](./quickstart.md) — run it locally, verify it works

## Phase 2 — Implementation Sequence

Mapped from `SPEC.md` §11, and numbered as its **milestones 1–8**. Note these
are not the same numbers as the seven phases in [tasks.md](./tasks.md): milestone
6 below is that document's Phase 5, and milestone 7 is its Phase 6. Each
milestone is independently verifiable, and the tool is genuinely usable from
milestone 6 onward.

| Phase | Deliverable | Gate to pass | Key |
|---|---|---|---|
| 1 | `/api/iptest` deployed; Meetup fetched from Vercel 5× over an hour | **Status 200, expected size, body contains `@type":"Event"`, every attempt** | no |
| 2 | `lib/meetup.ts` — port the parser; fixtures reproduce prototype output | 12 Chiang Mai events parsed, 12/12 with organizer | no |
| 3 | `lib/normalize.ts` + `lib/time.ts` — filter, dedupe, local time | Dropped counts match the prototype; 11:00Z renders 18:00 | no |
| 4 | `app/page.tsx` — city, date range, Run, results table | A person can run a search and read the result | no |
| 5 | `/api/export.csv` — BOM, column order | Thai venue names open correctly in Excel | no |
| 6 | **Deploy public and ship to Sunny — no login** | Anyone on the team opens the URL and runs a search with no sign-in | no |
| 7 | `lib/places.ts` + `lib/cache.ts` — enrichment **with** its venue cache, behind password protection (T032) | Unverified venues carry no contact data; repeat runs re-bill nothing; a stranger cannot trigger a billable run | **yes** |
| 8 | Query cache | Only if someone asks for it | no |

**Phase 1 is a gate, not a task.** If Meetup blocks Vercel's IPs, the
architecture changes — the fetch moves to GitHub Actions on a schedule with
committed JSON, and the app serves that instead. Nothing beyond Phase 1 should
be written until it passes, and `/api/iptest` is deleted once it has.

**Milestone 6 is the delivery point.** Milestones 2–6 produce a deployed,
working tool with no external keys and no login — nothing is spent and nothing
is written, so there is nothing to protect. It should reach Sunny before
milestone 7 begins, so the first real feedback arrives while Places is still a
decision rather than a dependency.

**Milestone 7 ships enrichment, its cache and its protection together.**
Splitting the cache off means re-paying for the same venues on every run, since
venue repetition is low (29 unique across 30 events). Splitting the protection
off leaves a public button spending a real key.

## Complexity Tracking

No constitution gates are violated, and no entry is needed here.

Two things are worth naming as deliberate simplicity rather than oversight:

| Choice | Why it is not a gap |
|---|---|
| No database | Nothing in v1 is written by a human. A database becomes necessary the moment outreach notes exist — which is explicitly out of scope. |
| No query cache | A run takes 2–4 seconds for 3–5 users. A cache would add a storage dependency and an invalidation bug surface to save time nobody is losing. |
