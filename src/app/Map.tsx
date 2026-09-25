"use client";

import { useEffect, useRef, useState } from "react";
import type { Event } from "../types.ts";

// Leaflet + OpenStreetMap: no key, no account, no billing. See SPEC.md 6.1b.
const CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

declare global {
  interface Window {
    L?: any;
  }
}

let loader: Promise<any> | null = null;

function load(): Promise<any> {
  if (window.L) return Promise.resolve(window.L);
  // One shared promise: a per-call script element could not be retried once it
  // had already fired load or error, which left the map dead for the session.
  if (loader) return loader;
  if (!document.querySelector(`link[href="${CSS}"]`)) {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = CSS;
    document.head.appendChild(l);
  }
  loader = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = JS;
    s.async = true;
    s.onload = () => {
      // A captive portal can answer 200 with HTML: onerror never fires, so check.
      if (window.L) return resolve(window.L);
      loader = null;
      reject(new Error("map library did not load"));
    };
    s.onerror = () => {
      loader = null; // let a later run try again
      s.remove();
      reject(new Error("map library unavailable"));
    };
    document.body.appendChild(s);
  });
  return loader;
}

/** Escape for HTML text and quoted attributes alike. */
function esc(s: string | null): string {
  return (s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Only http(s) reaches an href; a scraped `javascript:` URL must not. */
function safeHref(u: string): string | null {
  try {
    const p = new URL(u);
    return p.protocol === "http:" || p.protocol === "https:" ? esc(u) : null;
  } catch {
    return null;
  }
}

export default function Map({ events }: { events: Event[] }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const [failed, setFailed] = useState(false);

  const pins = events.filter((e) => e.lat != null && e.lng != null);

  // One marker per venue, not per event: two events at the same place stack
  // exactly on top of each other and the second is invisible. Grouping also
  // surfaces the repeat venues, which are the stronger leads.
  const byPlace: Record<string, Event[]> = {};
  for (const e of pins) {
    const key = `${e.lat!.toFixed(5)},${e.lng!.toFixed(5)}`;
    (byPlace[key] ??= []).push(e);
  }
  const venues = Object.values(byPlace);

  useEffect(() => {
    if (pins.length === 0) return;
    let dead = false;
    setFailed(false);
    load()
      .then((L) => {
        if (dead || !box.current) return;
        map.current ??= L.map(box.current, { scrollWheelZoom: false });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 19,
        }).addTo(map.current);
        const group = L.layerGroup().addTo(map.current);
        for (const at of venues) {
          const head = at[0];
          const where = [head.venue, head.address].filter(Boolean).map(esc).join("<br>");
          const list = at
            .map((e) => {
              const href = safeHref(e.url);
              const name = href
                ? `<a href="${href}" target="_blank" rel="noreferrer">${esc(e.name)}</a>`
                : esc(e.name);
              return `<li>${esc(e.startLocal)} — ${name}</li>`;
            })
            .join("");
          group.addLayer(
            L.marker([head.lat, head.lng]).bindPopup(
              `<strong>${where}</strong>` +
                (at.length > 1 ? `<br><em>${at.length} events</em>` : "") +
                `<ul class="pev">${list}</ul>`,
            ),
          );
        }
        map.current.fitBounds(
          pins.map((e) => [e.lat, e.lng]),
          { padding: [30, 30], maxZoom: 15 },
        );
      })
      .catch(() => {
        if (!dead) setFailed(true);
      });
    return () => {
      dead = true;
      map.current?.remove();
      map.current = null;
    };
  }, [events]);

  if (pins.length === 0) return null;

  return (
    <div className="mapwrap">
      {failed && <p className="note warn">The map could not load. The leads below are unaffected.</p>}
      <div ref={box} className="map" hidden={failed} />
      {!failed && (
        <p className="maplegend">
          {venues.length} {venues.length === 1 ? "location" : "locations"} on the map, {pins.length} of{" "}
          {events.length} leads — the rest publish an address with no coordinates.
        </p>
      )}
    </div>
  );
}
