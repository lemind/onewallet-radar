# onewallet-radar

Finds upcoming events in Thai cities and the businesses attached to them — venues and
organizers — as partner leads for One Wallet.

## Why

One Wallet's best partners come through events (nomad meetups, festivals, tech events).
Today that research is manual, one city at a time. This makes it repeatable.

Each scraped event yields two leads:

- **venue** — where it is held (often a café, coworking or coliving space)
- **organizer** — who runs it, i.e. someone with an audience of expats and nomads

## Status

Scraper only. No UI, no pipeline, no database yet.

## Sources

| Source | Method | Gives organizer | Notes |
|---|---|---|---|
| Meetup | JSON-LD in raw HTML | yes | primary source, ~75% of results |
| Eventbrite | `window.__SERVER_DATA__` blob | no | brittle, date-only timestamps |

Eventpop, Ticketmelon and tourismthailand.org were evaluated and rejected: JS-rendered
or bot-blocked. They need a rendering scraper (e.g. Firecrawl) and are the route to
Thai-language provincial events later.

## Coverage

Meetup and Eventbrite are expat-facing platforms. Expect useful volume in Chiang Mai,
Bangkok and Phuket (~10-15 events per city per week) and close to nothing elsewhere.
Provincial Thai events live on Facebook and Thai ticketing sites, which are not covered.

## Data

Scrape output is committed to `data/*.json`. This is deliberate:

- it is the datastore — no database is needed until humans start typing notes
- git history gives a free daily archive of what changed
- the app works offline from committed data, so a demo never depends on a live scrape

## Stack

- TypeScript, Node 22
- Next.js on Vercel (serving only)
- GitHub Actions daily cron runs the scrape and commits the JSON
- No API keys required

## Develop

```bash
npm install
npm run scrape -- --city chiang-mai --days 7
```
