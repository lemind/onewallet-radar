# Contract: `GET /api/export.csv`

**Date**: 2026-09-24 | **Plan**: [../plan.md](../plan.md)

Same pipeline and same parameters as [`/api/run`](./run.md), rendered as a
spreadsheet file instead of JSON.

---

## Request

```
GET /api/export.csv?city=chiang-mai&from=2026-09-24&to=2026-10-01
```

Parameters and validation are identical to `/api/run`.

---

## Response — 200

```
Content-Type:        text/csv; charset=utf-8
Content-Disposition: attachment; filename="onewallet-chiang-mai-2026-09-24.csv"
```

### Encoding — UTF-8 **with BOM**

The response body **must** begin with the byte-order mark `EF BB BF`.

This is not optional and not cosmetic. Without it, Excel on Windows interprets
the file as the system code page and every Thai venue name becomes mojibake —
which is most of the venue names in this dataset. FR-017 exists for this single
byte sequence. Verify it with a real Excel open, not a text editor, because
editors guess encodings well and Excel does not.

### Columns

Fixed order, one row per event, sorted by start ascending:

```
name, start_local, organizer, organizer_url, venue, district,
address, phone, website, source, url
```

| Column | Source | Empty when |
|---|---|---|
| `name` | `event.name` | never |
| `start_local` | `event.startLocal` | never |
| `organizer` | `event.organizer` | the source published none |
| `organizer_url` | `event.organizerUrl` | the source published none |
| `venue` | `event.venue` | address-only event |
| `district` | `event.district` | `venueMatch !== "matched"` |
| `address` | `event.address` | venue-name-only event |
| `phone` | `event.phone` | `venueMatch !== "matched"` |
| `website` | `event.website` | `venueMatch !== "matched"` |
| `source` | `"meetup"` | never |
| `url` | `event.url` | never |

**No UTC column.** `startUtc` is stored, never exported — exporting both invites
someone to read the wrong one. **No rating column**; it is not a BD decision
input and sits in a costlier field tier.

### Formatting

| Rule | Detail |
|---|---|
| `start_local` | `YYYY-MM-DD HH:MM` — a space, not a `T`, and no offset suffix. Spreadsheets parse it as a datetime and humans read it without decoding. |
| Date-only precision | Date rendered, time cell **empty**. Never `00:00`. |
| Null | Empty cell. Never `null`, `N/A` or `-`. |
| Quoting | Wrap any field containing a comma, quote or newline in double quotes; escape inner quotes by doubling. Thai addresses contain commas routinely. |
| Line ending | `\r\n`, for Excel. |
| Header | Always present, even when there are no rows. |

### Zero rows

A 200 with the header row and nothing after it. Downloading an empty sheet is a
clearer answer than an error for "nothing on this week", and it matches what
`/api/run` reports.

---

## Response — 400 / 502

Same conditions as [`/api/run`](./run.md). Errors return **JSON, not CSV** —
`Content-Type: application/json` — so the browser never saves a file containing
an error message that a user might later read as data.

Enrichment failure is **not** an error here: the file downloads with empty
district, phone and website columns, consistent with FR-019. The warning belongs
on the page, next to the download button, since a CSV has nowhere to put one.
