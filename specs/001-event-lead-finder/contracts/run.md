# Contract: `GET /api/run`

**Date**: 2026-09-24 | **Plan**: [../plan.md](../plan.md)

The only data endpoint. Fetches, normalizes, filters and (from Phase 7)
enriches, returning a `RunResult`.

---

## Request

```
GET /api/run?city=chiang-mai&from=2026-09-24&to=2026-10-01
```

| Param | Type | Required | Rule |
|---|---|---|---|
| `city` | `chiang-mai` \| `bangkok` \| `phuket` | yes | Unknown value → 400 |
| `from` | `YYYY-MM-DD` | yes | Inclusive |
| `to` | `YYYY-MM-DD` | yes | Inclusive; must be ≥ `from` |

No body, no auth header — access is enforced at the deployment layer by Vercel
Authentication (FR-022), not in application code.

**Range rules**: `from` in the past is accepted and clamped to now minus 12
hours, so an event already under way still appears. A range longer than 60 days
is accepted but the response is unchanged — sources publish close to the date,
so a wide range simply returns what exists. The UI says so; the API does not
refuse it.

---

## Response — 200

Returned whenever the event source was reached, **including when enrichment
failed and when zero events matched**.

```json
{
  "city": "chiang-mai",
  "from": "2026-09-24",
  "to": "2026-10-01",
  "fetchedAt": "2026-09-24T09:06:50.950Z",
  "events": [
    {
      "source": "meetup",
      "name": "New In Town Meetup: Welcome to Chiang Mai!",
      "url": "https://www.meetup.com/.../events/316427571/",
      "startUtc": "2026-09-24T11:00:00.000Z",
      "startLocal": "2026-09-24 18:00",
      "end": null,
      "venue": "Spice Garden",
      "address": "17 Moonmuang Rd Lane 5, Tambon Si Phum, Chiang Mai 50200",
      "organizer": "Beyond Small Talk, Chiang Mai",
      "organizerUrl": "https://www.meetup.com/beyond-small-talk-chiang-mai/"
    }
  ],
  "dropped": {
    "online": 18, "noVenue": 0, "noDate": 0, "outOfRange": 3, "duplicate": 3
  },
  "errors": []
}
```

**Guarantees**

1. `events` is sorted by `startUtc` ascending.
2. Every event has a non-empty `url`.
3. Every event has a `venue` or an `address`.
4. `startLocal` is `startUtc` rendered in `Asia/Bangkok`, as `YYYY-MM-DD HH:MM`.
5. Before Phase 6 there are no enrichment fields at all — that is a valid and
   complete response, not a degraded one. Phase 6 adds `phone` and `venueMatch`,
   and the all-or-nothing rule then applies: `venueMatch !== "matched"` implies
   `phone` is null.

---

## Response — 200 with partial failure

Enrichment failing does **not** fail the run (FR-019). Events are returned with
empty enrichment columns and the reason is named:

```json
{
  "events": [ { "...": "...", "venueMatch": "not_attempted", "district": null } ],
  "errors": [
    { "source": "places", "message": "Places request failed: 429 rate limited" }
  ]
}
```

The UI must surface a warning whenever `errors` is non-empty while `events` is
populated. Silently returning a thinner result is the failure mode this contract
exists to prevent.

---

## Response — 200 with no results

```json
{ "events": [], "dropped": { "online": 4, "...": 0 }, "errors": [] }
```

Empty `events` **and** empty `errors` means "nothing on in that range". The UI
must render this as an explicit empty state naming the city and range (FR-021).
A near-empty week is a correct answer in a city this size, not a malfunction.

---

## Response — 400

Invalid or missing parameter. Nothing was fetched.

```json
{ "error": "unknown city: phnom-penh", "events": [] }
```

---

## Response — 502

**The event source itself was unreachable.** This is the one case where the run
fails, because there is nothing truthful to return (FR-020).

```json
{
  "error": "meetup unreachable",
  "events": [],
  "errors": [ { "source": "meetup", "message": "fetch failed: 403" } ]
}
```

No cached or stale data is substituted. The UI must distinguish this from the
empty-result case — that distinction is the entire point of separating them.

---

## Behaviour notes

**Timeouts**: 25 seconds on the Meetup fetch. The measured scrape is 2–4
seconds; anything approaching the limit means blocking or throttling, which is
worth surfacing rather than absorbing.

**Places calls** (Phase 7) run concurrently across unique venues, not per event —
29 unique venues across 30 events, so per-event lookups would over-bill by
roughly the repeat rate. Cache hits are checked before any request is made.

**No caching before Phase 7.** Every call fetches. At 2–4 seconds and a handful
of runs per day this is the correct trade; see research D5.

**User-Agent**: send a normal desktop browser UA, as the prototype did. Without
it the listing HTML differs.
