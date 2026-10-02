/**
 * Fill src/data/venues.ts with coordinates, by hand, once.
 *
 * Nothing in the app geocodes any more: a lookup on a page rebuild bills on
 * every rebuild, and the cache it relied on does not survive a deploy. That
 * cost $40 on 2 Oct. This script is the only thing that may spend, it is run
 * deliberately, it prints the bill before making a call, and it never asks
 * twice for the same venue — a miss is written as null so it stays a miss.
 *
 *   npm run geocode -- --dry            what it would ask for, no calls
 *   npm run geocode -- --provider osm   free, OpenStreetMap, 1 req/sec
 *   npm run geocode -- --provider google --confirm
 */
import { readFileSync, writeFileSync } from "node:fs";
import { VENUES } from "../src/data/venues.ts";
import { venueKey } from "../src/lib/venues.ts";
import { CITIES } from "../src/lib/cities.ts";
import { distanceKm } from "../src/lib/normalize.ts";

const SITE = "https://onewallet-radar.vercel.app";
const OUT = new URL("../src/data/venues.ts", import.meta.url);

/** Nothing may spend more than this in one run, whatever the input says. */
const HARD_CAP = 300;

type Want = { key: string; query: string; city: (typeof CITIES)[number] };

/**
 * The venues the live pages publish without coordinates. Read from the site
 * rather than re-scraped: the pages already list every venue with its address,
 * and asking the sources again would be slower and ruder for the same answer.
 */
async function wanted(): Promise<Want[]> {
  const out = new Map<string, Want>();
  for (const city of CITIES) {
    const html = await (await fetch(`${SITE}/events/${city.id}`)).text();
    for (const block of html.matchAll(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
    )) {
      let parsed: any;
      try {
        parsed = JSON.parse(block[1]);
      } catch {
        continue;
      }
      for (const node of parsed["@graph"] ?? []) {
        if (node["@type"] !== "ItemList") continue;
        if (!String(node.name ?? "").startsWith("Event venues")) continue;
        for (const { item } of node.itemListElement) {
          if (item.geo) continue; // the source placed it; nothing to buy
          const key = venueKey(item.name, item.address);
          if (!key || key in VENUES) continue; // already answered, hit or miss
          out.set(key, {
            key,
            query: [item.name, item.address].filter(Boolean).join(", ").slice(0, 300),
            city,
          });
        }
      }
    }
  }
  return [...out.values()];
}

type Hit = { lat: number; lng: number } | null;

async function google(q: string, city: Want["city"]): Promise<Hit> {
  // Server-only key, the same one the runtime uses. Never the map key.
  const key = process.env.GOOGLE_GEOCODING_KEY;
  if (!key) throw new Error("GOOGLE_GEOCODING_KEY is not set");
  const url =
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}` +
    `&region=th&bounds=${city.lat - 1},${city.lng - 1}|${city.lat + 1},${city.lng + 1}&key=${key}`;
  const body = await (await fetch(url)).json();
  if (body.status === "ZERO_RESULTS") return null;
  if (body.status !== "OK") throw new Error(`${body.status}: ${body.error_message ?? ""}`);
  const loc = body.results[0]?.geometry?.location;
  return loc ? { lat: loc.lat, lng: loc.lng } : null;
}

async function osm(q: string, city: Want["city"]): Promise<Hit> {
  const url =
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=th` +
    `&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    // The usage policy requires an identifying agent; a stock one is refused.
    headers: { "User-Agent": "onewallet-radar/1.0 (one-off venue geocoding)" },
  });
  const body = (await res.json()) as { lat: string; lon: string }[];
  const first = body[0];
  return first ? { lat: Number(first.lat), lng: Number(first.lon) } : null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Rewrite the data file, sorted, so a diff shows what one run actually added. */
function write(table: Record<string, Hit>) {
  const body = Object.keys(table)
    .sort()
    .map((k) => {
      const v = table[k];
      const val = v ? `{ lat: ${v.lat}, lng: ${v.lng} }` : "null";
      return `  ${JSON.stringify(k)}: ${val},`;
    })
    .join("\n");
  const head = readFileSync(OUT, "utf8").split("export const VENUES")[0];
  writeFileSync(OUT, `${head}export const VENUES: Record<string, Fixed | null> = {\n${body}\n};\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const provider = args.includes("--provider") ? args[args.indexOf("--provider") + 1] : "osm";
  const confirmed = args.includes("--confirm");

  const todo = await wanted();
  console.log(`${Object.keys(VENUES).length} venues already on file.`);
  console.log(`${todo.length} unplaced venues have no entry yet.`);

  if (todo.length > HARD_CAP) {
    console.error(`Refusing: ${todo.length} is over the ${HARD_CAP} hard cap. Raise it on purpose.`);
    process.exit(1);
  }
  if (dry || todo.length === 0) {
    for (const w of todo) console.log(`  would ask: ${w.query}`);
    process.exit(0);
  }
  if (provider === "google" && !confirmed) {
    console.error(
      `google is billable: ${todo.length} calls, free up to 10,000 a month, then $5 per 1,000.\n` +
        `Re-run with --confirm if that is what you want, or use --provider osm for free.`,
    );
    process.exit(1);
  }

  const table: Record<string, Hit> = { ...VENUES };
  let found = 0;
  for (const [i, w] of todo.entries()) {
    try {
      const hit = provider === "google" ? await google(w.query, w.city) : await osm(w.query, w.city);
      // A geocoder answers with the district centre when it cannot find the
      // place, so reject anything outside the city before writing it down.
      const ok = hit && distanceKm(w.city.lat, w.city.lng, hit.lat, hit.lng) <= w.city.radiusKm;
      table[w.key] = ok ? hit : null;
      if (ok) found++;
      console.log(`${i + 1}/${todo.length} ${ok ? "ok  " : "miss"} ${w.query.slice(0, 70)}`);
    } catch (err) {
      console.error(`${i + 1}/${todo.length} FAILED ${w.query.slice(0, 50)}: ${err}`);
      break; // stop on the first error rather than burn the rest of the budget
    }
    // Nominatim's policy is one request a second; Google does not care.
    if (provider === "osm") await sleep(1100);
  }

  write(table);
  console.log(`\nWrote ${Object.keys(table).length} entries, ${found} newly located.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
