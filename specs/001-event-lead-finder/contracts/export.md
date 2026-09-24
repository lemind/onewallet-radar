# Contract: CSV export

**Date**: 2026-09-24 (revised) | **Plan**: [../plan.md](../plan.md)

**There is no export endpoint.** The CSV is built **in the browser** from the
`RunResult` already held in page state, and saved via a Blob URL.

That is deliberate: a second endpoint would re-run the whole scrape just to
produce a file the page already has the data for — doubling the load on Meetup
and risking a download that disagrees with the table above it.

`src/lib/csv.ts` must therefore stay browser-safe: no `Buffer`, no `fs`, and the
BOM prepended as the string `"﻿"` rather than a byte sequence.

---

## Columns

Fixed order, one row per event, sorted by start ascending. **Eight columns**:

```
name, start_local, organizer, organizer_url, venue, address, source, url
```

| Column | Source | Empty when |
|---|---|---|
| `name` | `event.name` | never |
| `start_local` | `event.startLocal` | never |
| `organizer` | `event.organizer` | the source published none |
| `organizer_url` | `event.organizerUrl` | the source published none |
| `venue` | `event.venue` | address-only event |
| `address` | `event.address` | venue-name-only event |
| `source` | `"meetup"` | never |
| `url` | `event.url` | never |

**No UTC column.** `startUtc` is stored and used for sorting, never exported —
exporting both invites someone to read the wrong one.

**No `district`, `phone`, `website` or `rating` columns.** District was cut along
with the district filter it existed to serve. When Places enrichment lands
(Phase 6) it adds **`phone`** and a Places-verified **`address`**; district and
rating stay cut.

## Encoding — UTF-8 **with BOM**

The string must begin with `﻿`.

Not optional, not cosmetic: without it Excel on Windows reads the file as the
system code page and every Thai venue name becomes mojibake — and most venue
names in this dataset are Thai. Verify with a real Excel open, not a text
editor, because editors guess encodings well and Excel does not.

## Formatting

| Rule | Detail |
|---|---|
| `start_local` | `YYYY-MM-DD HH:MM` in `Asia/Bangkok` — a space, not a `T`, and no offset suffix |
| Null | Empty cell. Never `null`, `N/A` or `-` |
| Quoting | Wrap any field containing a comma, quote, CR or LF in double quotes; escape inner quotes by doubling. Thai addresses contain commas routinely |
| Line ending | `\r\n`, for Excel |
| Header | Always present, even with zero rows |

## Filename

`onewallet-<city>-<from>.csv`, e.g. `onewallet-chiang-mai-2026-09-24.csv`.

## Zero rows

Header row and nothing after it. The page does not offer the download button
when there are no events, so this is reachable only programmatically.

## Verified by

`tests/parse.test.ts` — BOM present, Thai round-trips, commas quoted, inner
quotes doubled, CRLF present, header emitted with no rows.
