"use client";

import { useEffect, useRef, useState } from "react";
import type { Event } from "../types.ts";
import { LATER, TODAY, bangkokToday, isToday } from "../lib/when.ts";

// Leaflet draws the markers; MapLibre draws the basemap from MapTiler vector
// tiles, which is the only way to get English labels — see SPEC.md 6.1b.
// Raster tiles bake the label language in, and OSM renders Thai in Thailand.
const SHEETS = [
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css",
];
// Order matters: the plugin needs both globals before it will register.
const SCRIPTS = [
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js",
  "https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.0.22/leaflet-maplibre-gl.js",
];

const KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
// language=en makes the style label with {name:en}, falling back to the local
// name only where OpenStreetMap has no English one.
const STYLE = `https://api.maptiler.com/maps/streets-v2/style.json?key=${KEY}&language=en`;

declare global {
  interface Window {
    L?: any;
    maplibregl?: any;
  }
}

let loader: Promise<any> | null = null;

/**
 * Append all three at once with async=false: the browser downloads them in
 * parallel but still executes them in document order, which is what the plugin
 * needs. Awaiting each in turn would serialise ~960KB of downloads.
 */
function scripts(srcs: string[]): Promise<void> {
  return Promise.all(
    srcs.map((src) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
      // Re-executing leaflet.js would swap window.L for a fresh namespace.
      if (existing?.dataset.loaded === "true") return Promise.resolve();
      if (existing) existing.remove();
      return new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.async = false; // parallel fetch, in-order execution
        s.onload = () => {
          s.dataset.loaded = "true";
          resolve();
        };
        s.onerror = () => {
          s.remove();
          reject(new Error(`could not load ${src}`));
        };
        document.body.appendChild(s);
      });
    }),
  ).then(() => undefined);
}

function ready(): boolean {
  // Both globals, not just the plugin: a captive portal answering 200 with HTML
  // fires onload, and the plugin registers L.maplibreGL without ever touching
  // maplibregl, so checking the plugin alone would pass on a broken load.
  return Boolean(window.L?.maplibreGL && window.maplibregl);
}

function load(): Promise<any> {
  if (ready()) return Promise.resolve(window.L);
  // One shared promise: a per-call script element could not be retried once it
  // had already fired load or error, which left the map dead for the session.
  if (loader) return loader;
  for (const href of SHEETS) {
    if (document.querySelector(`link[href="${href}"]`)) continue;
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = href;
    document.head.appendChild(l);
  }
  loader = scripts(SCRIPTS)
    .then(() => {
      if (!ready()) throw new Error("map library did not load");
      return window.L;
    })
    .catch((err) => {
      loader = null; // let a later run try again
      throw err;
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
  // HACK(allevents): the venue is part of the key because sources stamp the city-centre coordinate on anything they cannot geocode, so one point can hold several unrelated venues. Measured 26 Sep, Bangkok.
  // REVISIT: key on the coordinate alone once no source falls back to a city centre.
  const byPlace: Record<string, Event[]> = {};
  for (const e of pins) {
    const key = `${e.lat!.toFixed(5)},${e.lng!.toFixed(5)}|${e.venue ?? ""}|${e.address ?? ""}`;
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
        // maxZoom lived on the old tile layer; the GL layer sets none, which
        // left the map unbounded and the basemap frozen past the tile limit.
        map.current ??= L.map(box.current, { scrollWheelZoom: false, maxZoom: 19 });
        const base = L.maplibreGL({
          style: STYLE,
          attribution:
            '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> ' +
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map.current);
        const group = L.layerGroup().addTo(map.current);
        const today = bangkokToday();
        for (const at of venues) {
          const head = at[0];
          // A venue is "today" if anything it hosts today is still to come.
          const colour = at.some((e) => isToday(e.startLocal, today)) ? TODAY : LATER;
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
          const marker = L.circleMarker([head.lat, head.lng], {
            radius: 8,
            color: "#ffffff",
            weight: 2,
            fillColor: colour,
            fillOpacity: 1,
          }).bindPopup(
            `<strong>${where}</strong>` +
              (at.length > 1 ? `<br><em>${at.length} events</em>` : "") +
              `<ul class="pev">${list}</ul>`,
          );
          group.addLayer(marker);
          // L.marker ships a focusable <img role="button">; a circleMarker is a
          // bare <path>, so keyboard users lose every popup unless we say so.
          const el = marker.getElement() as SVGElement | null;
          if (el) {
            el.setAttribute("tabindex", "0");
            el.setAttribute("role", "button");
            el.setAttribute("aria-label", `${head.venue ?? "Venue"}, ${at.length} event${at.length > 1 ? "s" : ""}`);
            el.addEventListener("keydown", (ev) => {
              const k = (ev as KeyboardEvent).key;
              if (k === "Enter" || k === " ") {
                ev.preventDefault();
                marker.openPopup();
              }
            });
          }
        }
        map.current.fitBounds(
          pins.map((e) => [e.lat, e.lng]),
          { padding: [30, 30], maxZoom: 15 },
        );
        // Only now does the layer have a GL map: Leaflet defers onAdd until the
        // view is set. A rejected key, an exhausted quota or an unreachable
        // style arrives as an async event, not a throw, so without this the map
        // would sit blank with no message.
        base.getMaplibreMap()?.on("error", () => {
          if (!dead) setFailed(true);
        });
      })
      .catch(() => {
        if (!dead) setFailed(true);
      });
    return () => {
      dead = true;
      // The GL plugin's onRemove calls this._glMap.remove() unguarded, so when
      // WebGL never initialised the teardown throws — and a throw from a React
      // cleanup takes the whole page down, not just the map. SPEC.md 9.11.
      try {
        map.current?.remove();
      } catch {
        // A half-torn-down container keeps Leaflet's id and the next run dies
        // with "Map container is being reused by another instance".
        const el = box.current as (HTMLDivElement & { _leaflet_id?: number }) | null;
        if (el) {
          delete el._leaflet_id;
          el.innerHTML = "";
        }
      } finally {
        map.current = null;
      }
    };
  }, [events]);

  if (pins.length === 0) return null;

  return (
    <div className="mapwrap">
      {failed && <p className="note warn">The map could not load. The leads below are unaffected.</p>}
      <div ref={box} className="map" hidden={failed} />
      {!failed && (
        <p className="maplegend">
          <span className="key">
            <i className="dot" style={{ background: TODAY }} /> today
          </span>
          <span className="key">
            <i className="dot" style={{ background: LATER }} /> later
          </span>
          {venues.length} {venues.length === 1 ? "location" : "locations"} on the map, {pins.length} of{" "}
          {events.length} leads — the rest publish an address with no coordinates.
        </p>
      )}
    </div>
  );
}
