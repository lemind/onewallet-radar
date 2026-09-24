# onewallet-radar

Finds upcoming events in Thai cities and the businesses attached to them — venues and
organizers — as partner leads for One Wallet.

Pick a city and a date range, press Run, download a spreadsheet.

## Why

One Wallet's best partners come through events (nomad meetups, expat socials, tech
events). Today that research is manual, one city at a time. This makes it repeatable.

Each event yields two leads:

- **venue** — where it is held, usually a café, bar, coworking or coliving space
- **organizer** — who runs it, i.e. someone with a standing audience of expats and nomads

## Status

**Working MVP.** Scrapes Meetup, filters, and exports CSV. Deployed on Vercel.

No login, no database, no API keys. Venue contact enrichment (phone, website,
district via Google Places) is designed but not built — see `SPEC.md` §9.4.

## Run it

```bash
nvm use          # Node 22
npm install
npm run dev      # http://localhost:3000
npm test         # 11 tests, offline against a saved fixture
npm run build
```

## Measured coverage

A live run on 24 Sep 2026, 7-day window:

| City | Events | Online dropped |
|---|---|---|
| Chiang Mai | 10 | 2 |
| Bangkok | 9 | 3 |
| Phuket | 4 | 4 |

Expect **10–15 usable events per city per week**. This is a list a person reads on a
Monday, not a data feed.

Only these three cities are supported. Meetup is an expat-facing platform, so coverage
elsewhere in Thailand approaches zero — provincial events are announced in Thai on
Facebook and Thai ticketing sites, which this cannot reach. A 77-province dropdown
would be empty in most of them; that is why there isn't one.

## How it works

```
pick city + date range
   ↓
fetch the Meetup city listing
   ↓
extract schema.org Event records from its ld+json blocks
   ↓
drop online / venueless / out-of-range / duplicate
   ↓
render in Asia/Bangkok
   ↓
CSV, built in the browser
```

| Source | Method | Organizer |
|---|---|---|
| Meetup | `application/ld+json` in the raw HTML | yes, 12/12 measured |

Eventbrite was working in the prototype and is **deferred**: no organizer field,
date-only timestamps, and a parser that reads an internal JS blob. Eventpop,
Ticketmelon, tourismthailand.org, allevents.in and Chiang Mai Citylife were evaluated
and rejected — JS-rendered or bot-blocked. Reaching Thai-language provincial events
needs a rendering scraper such as Firecrawl. See `SPEC.md` §6.

## Things that are easy to get wrong

- **Times are exported in `Asia/Bangkok`.** Meetup publishes UTC — `11:00Z` is a 6pm
  event. Exporting raw UTC makes every row wrong by seven hours.
- **The CSV carries a UTF-8 BOM.** Without it Excel mangles every Thai venue name.
- **District is an output column, never a search input.** As a filter it would force a
  paid lookup on every venue just to discard most of them.
- **About half of raw results are online events** leaking into city searches. They are
  filtered out, so the raw count is roughly double the useful count.

## Stack

TypeScript, Node 22, Next.js on Vercel. Native `fetch`, no scraping framework, no
headless browser, no database, no cache.

## Docs

- `SPEC.md` — the approved spec and the measured limits behind every decision
- `specs/001-event-lead-finder/` — spec, plan, research, data model, contracts, tasks
- `prototype/` — the Python prototype the fixtures came from. **Reference only**; a
  code review found four bugs in it, all fixed in the TypeScript rather than ported.
