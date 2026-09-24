# Phase 0 Research: Event-Sourced Partner Lead Finder

**Date**: 2026-09-24 | **Plan**: [plan.md](./plan.md)

Unusually for a Phase 0, most of this is already settled. A working Python
prototype was run against six live sources on 24 Sep 2026, producing 30 events
across Chiang Mai, Bangkok and Phuket. The decisions below rest on those
measurements, not on estimates. `SPEC.md` §9 is the long form.

---

## D1. Event source: Meetup only

**Decision**: Extract `application/ld+json` event blocks from the raw Meetup
city listing HTML. It is the only source in v1.

**Rationale**: Measured across three cities, Meetup produced 22 of 30 events and
was the only source publishing an organizer — 12/12 of measured events carried
both `organizer.name` and `organizer.url`. It publishes full timestamps. The
JSON-LD is a documented schema.org contract rather than an internal structure,
so it is the least likely to break silently.

**Alternatives rejected**:

| Source | Measured outcome |
|---|---|
| **Eventbrite** | Worked — 8/30 events — but publishes **no organizer**, returns **date-only** timestamps (every record `00:00:00`, no offset), and requires reading `window.__SERVER_DATA__`, an internal blob that can change without notice. Deferred, not deleted. |
| Eventpop | 2.7 KB shell; fully JS-rendered |
| Ticketmelon | JS-rendered, no structured data |
| tourismthailand.org | HTTP 403, bot-blocked |
| allevents.in | JSON-LD present but only FAQ and breadcrumb types |
| Chiang Mai Citylife | No event schema; would need a bespoke parser |

Deferring Eventbrite removes the entire date-precision problem and the most
fragile code in the project, for 25% of volume in the lowest-value rows.
Eventpop and Ticketmelon are the route to Thai-language provincial events and
would need a rendering scraper such as Firecrawl — a later phase.

---

## D2. District comes from enrichment, so it is an output column

**Decision**: Search by city only. District is produced by Places enrichment and
appears as a sortable CSV column, never as a search input.

**Rationale**: Meetup does publish `addressLocality` — on 10 of 12 measured
Chiang Mai events — but at inconsistent administrative levels:

| Published value | Actual level |
|---|---|
| `Amphoe Mueang Chiang Mai` | district |
| `Tambon Si Phum` | subdistrict |
| `Chiang Mai` | city |
| `Thailand` | country |

The same venue (Spice Garden) returned `Amphoe Mueang Chiang Mai` on one event
and `Tambon Si Phum` on another. No parser normalizes that reliably.

The design consequence matters more than the parsing one: as a **search input**,
district would force enrichment of every venue city-wide on every run just to
discard most of them — putting a billable API on the critical path of the main
button. As a **column** it is additive, and the tool works with no key at all.
At 10–15 events per city per week, filtering 12 rows to 3 is not worth a
dropdown either.

**Alternatives rejected**: scraping Google search results (JavaScript wall from
residential IPs, CAPTCHA from datacenter IPs); Nominatim/OpenStreetMap (matched
**1 of 6** venues — it is an address database, not a business database, and
small Thai venues are absent).

---

## D3. Time: store UTC, render Asia/Bangkok

**Decision**: Persist the published instant verbatim in `startUtc`; derive
`startLocal` in `Asia/Bangkok` for every surface a human sees. Carry
`startPrecision` so a date-only source can never become midnight.

**Rationale**: Meetup publishes `2026-09-24T11:00:00.000Z` for an event whose own
description reads *6:00 PM – 8:00 PM*. Exporting UTC would show a 6pm meetup as
11:00 — a wrong answer, not a formatting preference. Thailand has no DST and a
fixed +07:00 offset, so the conversion is unambiguous; using a named zone rather
than a hardcoded offset costs nothing and survives any later expansion.

`startPrecision` is a single-member union in v1 because Meetup always publishes a
full timestamp. It is kept as a compile-time guard: it forces whoever adds a
date-only source to handle the case instead of defaulting to midnight.

---

## D4. Venue matching: deliberately dumb, and all-or-nothing

**Decision**:

```
take candidate #1 only
→ lowercase, strip punctuation and generic words (cafe, bar, co-working)
→ string similarity against the source venue name
→ above threshold AND returned address contains the requested city
→ matched, else unmatched
```

An unmatched venue receives **no** enriched fields — not a partial fill.

**Rationale**: Text Search returns relevance-ranked candidates, not exact
matches. `The Edge` on Nimman Road could return `The Edge Cafe` or
`The Edge Apartments`. Since the output drives a human picking up the phone, a
wrong number is worse than a missing one: it costs a call and some credibility.
At ~29 venues a week a person can eyeball every unmatched row, so recall matters
less than precision.

**Alternatives rejected**: candidate ranking, fuzzy geo matching, and any scoring
model — all are entity resolution, which this problem does not have the volume
to justify. If the miss rate annoys anyone, tune the threshold.

---

## D5. No cache in v1; the venue cache ships *with* Places

**Decision**: No storage in Phases 1–6. In Phase 7, the venue cache ships in the
same change as the Places call. A query cache is deferred indefinitely.

**Rationale**: These are two different decisions that look like one. A query
cache is a **speed** optimization — worthless when a run takes 2–4 seconds for
five users, and it would add a storage dependency plus an invalidation bug
surface to save time nobody is losing. The venue cache is **cost control**:
venue repetition is low (29 unique venues across 30 events), so a cold run
enriches nearly every event, and shipping Places without it means re-paying for
the same venues on every single run.

**Storage choice**: Redis via the Vercel Marketplace. Vercel KV is sunset and
unavailable to a new project. Serverless has no writable disk, so any cache
means an add-on — which is exactly why none is added before it earns its keep.

---

## D6. Platform: Next.js on Vercel, single deployment

**Decision**: One Next.js app. Route handlers do the fetching; the same
deployment serves the page.

**Rationale**: A separate frontend and backend would double the deployment
surface for an app with one button. Vercel CLI is already authenticated for
`lemind`. Native `fetch` and a regex over the HTML are sufficient — the
prototype needed no HTML parser, no headless browser, and no scraping framework.

**Rejected — Fastify**: it is a long-running server; Vercel runs serverless
functions. It would be the right answer only if this moved to a VM.

**Rejected — a database**: nothing in v1 is written by a human. One becomes
necessary the moment outreach notes and stages exist, which is out of scope.

---

## D7. Access: none at delivery, a shared password once Places lands

**Decision**: Ship milestone 6 with **no login at all**. Add Vercel Password
Protection in milestone 7, in the same change as the API key.

**Rationale**: the trigger is spend, not privacy. Before Places, a Run fetches
one public Meetup listing page that anyone could open in a browser — it spends
nothing and writes nothing, so there is no asset to protect and a login only
stands between Sunny and the feedback we want. The moment a key exists, anyone
holding the URL can run up a Google bill and burn Meetup's tolerance for the
Vercel IP, and that is when protection earns its place.

A shared password beats team-account auth here because Sunny and the BD staff
are not in the Vercel team and should not have to be added to it to open a
spreadsheet tool.

**Rejected**: Vercel Authentication (would require adding BD staff to the Vercel
team); any login before milestone 7 (protects nothing, delays feedback); relying
on an unlisted URL after the key lands (not a control).

**Fallback** if password protection is unavailable on the plan: cap spend
instead — a per-run venue-lookup limit plus a Google Cloud budget alert.

---

## O1. Open — does Meetup serve Vercel's datacenter IPs?

**Status**: **Unresolved, and load-bearing.** This is the one genuine unknown.

The prototype ran from a residential IP. Vercel functions run from AWS
datacenter ranges, which is exactly what scraping targets commonly filter. In a
scheduled design a block would be harmless — yesterday's data stays live. In
this on-demand design **a block means the button returns nothing, in front of
the user.**

**Resolution**: Phase 1 is a throwaway `/api/iptest` route deployed to Vercel,
asserting status, response size, and the presence of `"@type":"Event"` in the
body, repeated 3–5 times over at least an hour. One success proves nothing if
the filtering is intermittent or reputation-based.

**If it fails**: move the fetch to GitHub Actions on a schedule and commit the
JSON to the repo, serving committed data from the app; or route the fetch
through a rendering service with proxy rotation. Either changes the
architecture, which is why nothing is built before this passes.

---

## O2. Open — what does "partner" mean to One Wallet?

**Status**: Open for the business owner. **Not blocking.**

The source brief uses the word for three different things: a *merchant* who
accepts payment, a *top-up point* where cash enters the wallet, and a *referrer*
who sends users. The word "top-up" never appears in the brief; the only hint is
"money exchange" in its business-type list.

The answer determines how leads should be **ranked** — and ranking is out of
scope for v1. Phases 1–6 are identical under all three readings. Ask Sunny in
parallel with the build; do not wait on it.

---

## O3. Terms of service

`robots.txt` on Meetup permits the listing paths used here. Meetup's **terms of
service** separately restrict automated collection. This is acceptable for an
internal prototype and is a real question before anything public or commercial.
A third-party scraping service would not change it — that changes who fetches
the page, not whether the site permits it.
