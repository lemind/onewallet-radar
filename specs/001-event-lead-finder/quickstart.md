# Quickstart: Event-Sourced Partner Lead Finder

**Date**: 2026-09-24 | **Plan**: [plan.md](./plan.md)

---

## Prerequisites

- Node 22 (`nvm use` — the version is pinned in `.nvmrc`)
- Vercel CLI, authenticated as `lemind`
- **No API keys** for anything before Phase 7

```bash
npm install
```

---

## Phase 1 first — the gate

Nothing else should be built until this passes. It answers the one question the
architecture depends on: does Meetup serve Vercel's datacenter IPs?

```bash
vercel deploy --prebuilt          # deploys /api/iptest and nothing else
curl -s "$DEPLOY_URL/api/iptest" | jq
```

Expected:

```json
{ "status": 200, "bytes": 298094, "hasEventSchema": true, "elapsedMs": 2340 }
```

**Pass** = `status: 200`, `bytes` in the expected range, and
`hasEventSchema: true` — on **every** attempt, run 3–5 times over at least an
hour. One success proves nothing if the filtering is intermittent or
reputation-based.

**Fail** (403, a challenge page, or `hasEventSchema: false` on any attempt) —
stop. The architecture changes: move the fetch to GitHub Actions on a schedule
and serve committed JSON, or route through a rendering service with proxy
rotation. Do not proceed under the assumption it will work.

Delete `/api/iptest` once the gate has passed.

---

## Local development

```bash
npm run dev          # http://localhost:3000
```

Note that local runs come from a residential IP, which is exactly what the
Phase 1 gate exists to distinguish from Vercel's. **Working locally proves
nothing about production.**

---

## Tests

```bash
npm test                      # all
node --test tests/meetup.test.ts
```

Tests run against saved HTML in `tests/fixtures/` — offline, deterministic, and
free of live-site flakiness.

### The acceptance test for the port

Phase 2–3 are correct when the TypeScript parser reproduces the Python
prototype's output from the same saved HTML:

| Assertion | Expected |
|---|---|
| Events parsed from the Chiang Mai fixture | 12 |
| Events carrying an organizer | 12 |
| Events carrying `organizerUrl` | 12 |
| Dropped: online / noVenue / noDate / outOfRange / duplicate | 18 / 0 / 0 / 3 / 3 |
| `2026-09-24T11:00:00.000Z` renders as | `2026-09-24 18:00` |

Any divergence is a porting bug, not an improvement. Fix the port.

---

## Manual verification

### Phases 2–5, locally

1. `npm run dev`, open the page
2. Select **Chiang Mai**, a 7-day range from today, press **Run**
3. Expect roughly 10–15 events, earliest first, each with a venue and a source
   link — and most with an organizer
4. Click any source link; the original listing should open and show that event
5. Check an evening event reads as an evening time. `18:00`, not `11:00` — if
   times look 7 hours early, the local-time conversion is wrong
6. Download the CSV and **open it in Excel**, not a text editor. Thai venue
   names must be readable; mojibake means the BOM is missing
7. Set a date range in the far future and confirm the empty state says "no
   events" rather than showing an error

### Phase 6, deployed

```bash
vercel --prod
```

Then, in a private browser window signed out of the Vercel team:

- Open the production URL → **access must be refused before any search runs**
- Open it as a team member → the search page loads with no extra password

Confirm the protection scope is **All Deployments**, not the preview-only
default, or production stays open.

### Phase 7, enrichment

With `GOOGLE_PLACES_API_KEY` set:

1. Run a Chiang Mai search; district, phone and website populate for confidently
   matched venues
2. Find a row marked unverified — all three columns must be **empty**. A
   plausible-looking phone number on an unverified row is the bug this phase is
   designed to prevent
3. Re-run the same search; cached venues must trigger no new billable lookups
4. Remove the key and re-run: events still return, enrichment columns empty, and
   a warning appears. The run must not fail

---

## Deploy

```bash
vercel                # preview
vercel --prod         # production
```

Environment variables (Phase 7 only):

| Name | Phase | Notes |
|---|---|---|
| `GOOGLE_PLACES_API_KEY` | 7 | Restrict it by API and referrer in Google Cloud |
| `REDIS_URL` | 7 | From the Vercel Marketplace Redis integration |

Phases 1–6 need neither.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| Empty results in production, fine locally | The Phase 1 gate. Meetup is blocking the datacenter IP |
| Times 7 hours early | UTC leaked to output; render `startLocal`, never `startUtc` |
| Thai names as `à¸` in Excel | Missing BOM on the CSV response |
| Every row unverified | Places key missing, unset, or the match threshold is too strict |
| Places bill climbing on repeat runs | Venue cache not checked before the request |
| About half of raw events disappear | Correct. Online events leaking into city searches — check the `dropped.online` counter |
