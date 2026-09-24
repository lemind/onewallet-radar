"use client";

import { useState } from "react";
import { CITIES } from "../lib/cities.ts";
import { toCsv, filename } from "../lib/csv.ts";
import type { RunResult } from "../types.ts";

function isoDate(d: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bangkok" }).format(d);
}

const TODAY = isoDate(new Date());
const IN_7 = isoDate(new Date(Date.now() + 7 * 864e5));

export default function Page() {
  const [city, setCity] = useState(CITIES[0].id);
  const [from, setFrom] = useState(TODAY);
  const [to, setTo] = useState(IN_7);
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

  return (
    <main className="wrap">
      <h1>onewallet radar</h1>
      <p className="sub">Upcoming events in Thai cities, and the venues and organizers behind them.</p>

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
          No events found in {CITIES.find((c) => c.id === result.city)?.label} between{" "}
          {result.from} and {result.to}. {raw > 0 && `${raw} listings were checked.`}
        </p>
      )}

      {result && result.events.length > 0 && (
        <>
          <div className="bar">
            <button className="ghost" onClick={download}>Download spreadsheet</button>
            <span className="count">
              Showing {result.events.length} of {raw} found
            </span>
          </div>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>When</th><th>Event</th><th>Venue</th><th>Organizer</th><th>Source</th>
                </tr>
              </thead>
              <tbody>
                {result.events.map((ev) => (
                  <tr key={`${ev.url}-${ev.startUtc}`}>
                    <td className="when">{ev.startLocal}</td>
                    <td>{ev.name}</td>
                    <td>{ev.venue ?? ev.address ?? "—"}</td>
                    <td>
                      {ev.organizerUrl ? (
                        <a href={ev.organizerUrl} target="_blank" rel="noreferrer">{ev.organizer}</a>
                      ) : (ev.organizer ?? "—")}
                    </td>
                    <td><a href={ev.url} target="_blank" rel="noreferrer">open</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
