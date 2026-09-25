"use client";

import { useEffect, useRef } from "react";
import type { Event } from "../types.ts";

// Leaflet + OpenStreetMap tiles: no key, no account, no billing. Loaded from a
// CDN at runtime so it adds nothing to the bundle and no dependency to audit.
const CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

declare global {
  interface Window {
    L?: any;
  }
}

function load(): Promise<any> {
  if (window.L) return Promise.resolve(window.L);
  if (!document.querySelector(`link[href="${CSS}"]`)) {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = CSS;
    document.head.appendChild(l);
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${JS}"]`) as HTMLScriptElement | null;
    const s = existing ?? document.createElement("script");
    s.src = JS;
    s.onload = () => resolve(window.L);
    s.onerror = () => reject(new Error("could not load the map library"));
    if (!existing) document.body.appendChild(s);
  });
}

export default function Map({ events }: { events: Event[] }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const layer = useRef<any>(null);

  const pins = events.filter((e) => e.lat != null && e.lng != null);

  useEffect(() => {
    let dead = false;
    load()
      .then((L) => {
        if (dead || !box.current || pins.length === 0) return;
        if (!map.current) {
          map.current = L.map(box.current, { scrollWheelZoom: false });
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "&copy; OpenStreetMap contributors",
            maxZoom: 19,
          }).addTo(map.current);
        }
        layer.current?.remove();
        layer.current = L.layerGroup().addTo(map.current);
        for (const e of pins) {
          const where = [e.venue, e.address].filter(Boolean).join("<br>");
          L.marker([e.lat, e.lng])
            .addTo(layer.current)
            .bindPopup(
              `<strong>${escape(e.name)}</strong><br>${e.startLocal}<br>${escape(where)}` +
                (e.url ? `<br><a href="${e.url}" target="_blank" rel="noreferrer">open</a>` : ""),
            );
        }
        map.current.fitBounds(pins.map((e) => [e.lat, e.lng]), { padding: [30, 30], maxZoom: 15 });
      })
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, [events]);

  if (pins.length === 0) return null;

  return (
    <div className="mapwrap">
      <div ref={box} className="map" />
      <p className="maplegend">
        {pins.length} of {events.length} leads on the map — the rest publish an address but no
        coordinates.
      </p>
    </div>
  );
}

function escape(s: string | null): string {
  return (s ?? "").replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
}
