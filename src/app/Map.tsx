"use client";

import { useEffect, useRef, useState } from "react";
import type { Event } from "../types.ts";
import { LATER, TODAY, bangkokToday, isToday } from "../lib/when.ts";

// Google Maps, for English street labels. Raster tiles bake the label language
// into the image and every keyless provider renders Thailand in Thai; Google
// takes a language parameter. See SPEC.md 6.1b.
const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
const CB = "__onewalletMapsReady";
const SRC = `https://maps.googleapis.com/maps/api/js?key=${KEY}&language=en&region=TH&callback=${CB}`;

declare global {
  interface Window {
    google?: any;
    gm_authFailure?: () => void;
  }
}

let loader: Promise<any> | null = null;

/**
 * Load via Google's `callback` parameter, not the script's onload. Measured
 * 28 Sep: at onload `google.maps` exists but `google.maps.Map` is still
 * undefined, so constructing there threw and every first search reported the
 * map as unavailable. The callback fires only once the API is usable.
 */
function load(): Promise<any> {
  if (loader) return loader;
  loader = new Promise<any>((resolve, reject) => {
    if (window.google?.maps?.Map) return resolve(window.google);
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
    if (existing) existing.remove();
    (window as any)[CB] = () => {
      delete (window as any)[CB];
      resolve(window.google);
    };
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onerror = () => {
      delete (window as any)[CB];
      s.remove();
      reject(new Error("map library unavailable"));
    };
    document.body.appendChild(s);
  }).catch((err) => {
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
  const markers = useRef<any[]>([]);
  const info = useRef<any>(null);
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
    // A rejected key reports here rather than throwing, so without this the
    // map would sit grey and watermarked with no explanation.
    window.gm_authFailure = () => {
      if (!dead) setFailed(true);
    };

    load()
      .then((google) => {
        if (dead || !box.current) return;
        // Reuse the map across searches. Each `new Map()` is a separately
        // billed load, and the old one was never disposed, so re-creating it
        // on every search both leaked and cost money.
        if (map.current && map.current.getDiv() !== box.current) map.current = null;
        map.current ??= new google.maps.Map(box.current, {
          mapTypeControl: false,
          streetViewControl: false,
          scrollwheel: false,
          maxZoom: 19,
        });
        // Markers belong to the map, not the run: clear the previous search's.
        for (const m of markers.current) m.setMap(null);
        markers.current = [];
        info.current ??= new google.maps.InfoWindow();
        const bounds = new google.maps.LatLngBounds();
        const today = bangkokToday();

        for (const at of venues) {
          const head = at[0];
          const colour = at.some((e) => isToday(e.startLocal, today)) ? TODAY : LATER;
          const where = [head.venue, head.address].filter(Boolean).map(esc).join("<br>");
          // Say so when the pin came from a venue lookup rather than the
          // source, so an inferred position is never read as published fact.
          const approx = head.located ? '<br><em>approximate location</em>' : "";
          const list = at
            .map((e) => {
              const href = safeHref(e.url);
              const name = href
                ? `<a href="${href}" target="_blank" rel="noreferrer">${esc(e.name)}</a>`
                : esc(e.name);
              return `<li>${esc(e.startLocal)} — ${name}</li>`;
            })
            .join("");
          const position = { lat: head.lat as number, lng: head.lng as number };
          bounds.extend(position);

          const marker = new google.maps.Marker({
            position,
            map: map.current,
            // Google gives a Marker keyboard focus and an accessible name from
            // the title, which a bare styled shape would not have.
            title: `${head.venue ?? "Venue"}, ${at.length} event${at.length > 1 ? "s" : ""}`,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: colour,
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            },
          });
          markers.current.push(marker);
          marker.addListener("click", () => {
            info.current.setContent(
              `<strong>${where}</strong>` +
                approx +
                (at.length > 1 ? `<br><em>${at.length} events</em>` : "") +
                `<ul class="pev">${list}</ul>`,
            );
            info.current.open({ anchor: marker, map: map.current });
          });
        }

        map.current.fitBounds(bounds, 30);
        // A single pin makes fitBounds zoom all the way in; hold it back.
        google.maps.event.addListenerOnce(map.current, "idle", () => {
          if (map.current && map.current.getZoom() > 15) map.current.setZoom(15);
        });
      })
      .catch(() => {
        if (!dead) setFailed(true);
      });

    return () => {
      dead = true;
      // Detach this run's markers. The map itself is kept: Google has no
      // destroy method, and a fresh one would be billed as another map load.
      for (const m of markers.current) m.setMap(null);
      markers.current = [];
      delete window.gm_authFailure;
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
          {events.length} leads.
        </p>
      )}
    </div>
  );
}
