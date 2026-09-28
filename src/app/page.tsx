"use client";

import { useState } from "react";
import { CITIES } from "../lib/cities.ts";
import { toCsv, filename } from "../lib/csv.ts";
import { BRAND, BRAND_SITE } from "../lib/site.ts";
import { LATER as COLOUR_LATER, TODAY as COLOUR_TODAY, bangkokToday, isToday } from "../lib/when.ts";
import type { RunResult } from "../types.ts";
import Map from "./Map.tsx";

function isoDate(d: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bangkok" }).format(d);
}

const TODAY = isoDate(new Date());
const DEFAULT_TO = isoDate(new Date(Date.now() + 7 * 864e5));

export default function Page() {
  const [city, setCity] = useState(CITIES[0].id);
  const [from, setFrom] = useState(TODAY);
  const [to, setTo] = useState(DEFAULT_TO);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/run?city=${city}&from=${from}&to=${to}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `request failed (${res.status})`);
      setResult(body as RunResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  // Built from state, so downloading never triggers a second scrape.
  function download() {
    if (!result) return;
    const blob = new Blob([toCsv(result.events)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename(result.city, result.from);
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const raw = result
    ? result.events.length + Object.values(result.dropped).reduce((a, b) => a + b, 0)
    : 0;
  // Once per render, not once per row.
  const today = bangkokToday();

  return (
    <main className="wrap">
      <div className="content">
      <div className="brand">
        {/* Wordmark is 108x20; height is set in CSS so it scales with the header. */}
        <img src="/logo.svg" alt="One Wallet" width={108} height={20} />
        {/* The wordmark carries "One Wallet" visually; the heading has to say it in text too. */}
        <h1><span className="vh">One Wallet </span>Radar</h1>
      </div>
      <p className="sub">
        Upcoming events in Bangkok, Chiang Mai and Phuket, and the venues and organizers behind them.
      </p>

      <form onSubmit={run}>
        <label>
          City
          <select value={city} onChange={(e) => setCity(e.target.value as typeof city)}>
            {CITIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </label>
        <label>
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button type="submit" disabled={busy}>{busy ? "Searching…" : "Run"}</button>
      </form>

      {error && <p className="note bad">Could not reach Meetup — {error}</p>}

      {result && result.notices?.length > 0 && (
        // Not a failure: a source hit its own page cap and said so.
        <p className="note">
          {result.notices.map((n) => `${n.source} — ${n.message}`).join("; ")}
        </p>
      )}

      {result && result.errors.length > 0 && (
        // Partial success: some data came back, some did not. Say which, rather than
        // letting a thinner result look like a complete one.
        <p className="note warn">
          Some details are missing:{" "}
          {result.errors.map((e) => `${e.source} — ${e.message}`).join("; ")}
        </p>
      )}

      {result && result.events.length === 0 && !error && (
        <p className="note">
          No leads in {CITIES.find((c) => c.id === result.city)?.label} between {result.from} and{" "}
          {result.to}. {raw > 0 && `${raw} listings were checked.`}
        </p>
      )}

      {result && result.events.length > 0 && (
        <>
          <div className="bar">
            <button className="ghost" onClick={download}>Download spreadsheet</button>
            <span className="count">
              <strong>{result.events.length} leads</strong> from {raw} listings
            </span>
          </div>
          <Map events={result.events} />
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>When</th><th>Event</th><th>Venue / address</th><th>Organizer</th><th>From</th><th>Link</th>
                </tr>
              </thead>
              <tbody>
                {result.events.map((ev) => (
                  <tr key={`${ev.url}-${ev.startUtc}`}>
                    <td className="when">
                      {/* Same green/blue as the map pins, from lib/when.ts. */}
                      <i
                        className="dot"
                        style={{ background: isToday(ev.startLocal, today) ? COLOUR_TODAY : COLOUR_LATER }}
                        title={isToday(ev.startLocal, today) ? "today" : "later"}
                      />
                      {ev.startLocal}
                    </td>
                    <td>{ev.name}</td>
                    <td>
                      {ev.online ? <em>Online</em> : (ev.venue ?? "—")}
                      {ev.address && <div className="addr">{ev.address}</div>}
                    </td>
                    <td>
                      {ev.organizerUrl ? (
                        <a href={ev.organizerUrl} target="_blank" rel="noreferrer">{ev.organizer}</a>
                      ) : (ev.organizer ?? "—")}
                    </td>
                    <td className="src">{ev.source}</td>
                    <td><a href={ev.url} target="_blank" rel="noreferrer">open</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <nav className="citynav">
        Browse what's on: <a href="/events">Events in Thailand</a>
        {CITIES.map((c) => (
          <span key={c.id}>
            {" · "}
            <a href={`/events/${c.id}`}>Events in {c.label}</a>
          </span>
        ))}
      </nav>

      {/* The form above renders as three inputs and nothing else, which gave a
          crawler 58 words to judge the site's own home page on. Measured 28 Sep. */}
      <section className="about prose">
        <h2>What this is</h2>
        <p>
          Radar collects events that are already published — on Meetup, Eventbrite, Luma,
          AllEvents and Resident Advisor — and puts the businesses behind them in one list. Pick a
          city and a date range and you get every event running in that window with the venue
          hosting it, the organizer running it, an address, a map pin and, where we can match the
          venue, a phone number and a website. The whole result downloads as a spreadsheet.
        </p>

        <h2>Why venues and organizers</h2>
        <p>
          A bar that hosts four nights a month and the promoter who fills it are both taking
          payments from visitors, and neither of them appears on any list of businesses to
          approach. The events are how you find them. A venue that keeps showing up across a
          month's listings is a stronger lead than the same venue found once.
        </p>

        <h2>What it will not do</h2>
        <p>
          Nothing here is written by hand and no detail is inferred. An event whose organizer
          published a date but no start time is shown as a date, not as midnight. A venue we
          cannot match confidently is left without a phone number rather than given someone
          else's. Every row keeps a link to the listing it came from, so anything can be checked
          at the source.
        </p>

        <h2>Cities covered</h2>
        <p>
          <a href="/events/bangkok">Bangkok</a> has the deepest calendar in the country and two
          separate markets inside it. <a href="/events/chiang-mai">Chiang Mai</a> runs the
          busiest weekday programme, driven by its remote-working population.{" "}
          <a href="/events/phuket">Phuket</a> is beach-club and resort led, and its season
          follows the flight schedule. <a href="/events">All three are listed here</a>.
        </p>
      </section>

      </div>

      <footer className="foot">
        A lead finder for{" "}
        <a href={BRAND_SITE} target="_blank" rel="noreferrer">
          {BRAND}
        </a>
        .
      </footer>
    </main>
  );
}
