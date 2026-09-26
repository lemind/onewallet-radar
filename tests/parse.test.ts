import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { extractEvents } from "../src/lib/ldjson.ts";
import { normalize, filterEvents } from "../src/lib/normalize.ts";
import { parseStart, toLocal } from "../src/lib/time.ts";
import { toCsv } from "../src/lib/csv.ts";

const HTML = readFileSync(new URL("./fixtures/meetup-chiang-mai.html", import.meta.url), "utf8");
const RAW = extractEvents(HTML);
const TAGGED = RAW.map((raw) => ({ raw, source: "meetup" as const }));

test("extracts every Event from the fixture", () => {
  assert.equal(RAW.length, 12);
});

test("every event carries an organizer name and url", () => {
  const norm = RAW.map((r) => normalize(r));
  assert.equal(norm.filter((n) => n.event.organizer).length, 12);
  assert.equal(norm.filter((n) => n.event.organizerUrl).length, 12);
});

test("every event carries a source url", () => {
  assert.ok(RAW.map((r) => normalize(r)).every((n) => n.event.url.startsWith("https://")));
});

test("a 6pm Chiang Mai event is not rendered as 11:00", () => {
  const p = parseStart("2026-09-24T11:00:00.000Z")!;
  assert.equal(toLocal(p.at, p.precision), "2026-09-24 18:00");
});

test("a timestamp with no offset is read as Bangkok, not UTC", () => {
  const p2 = parseStart("2026-09-26T19:00:00")!;
  assert.equal(toLocal(p2.at, p2.precision), "2026-09-26 19:00");
});

test("filter counts are stable against a fixed now", () => {
  const now = new Date("2026-09-24T00:00:00+07:00");
  const to = new Date("2026-10-01T23:59:59+07:00");
  const { events, dropped } = filterEvents(TAGGED, { now, to });
  const total = events.length + Object.values(dropped).reduce((a, b) => a + b, 0);
  assert.equal(total, 12, "every raw record is either kept or counted");
  assert.ok(events.length > 0, "the fixture week is not empty");
});

test("results come back in chronological order", () => {
  const { events } = filterEvents(TAGGED, {
    now: new Date("2026-09-24T00:00:00+07:00"),
    to: new Date("2026-10-01T23:59:59+07:00"),
  });
  const times = events.map((e) => new Date(e.startUtc).getTime());
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
});

test("an online event with no organiser is dropped, one with an organiser is kept", () => {
  const window = {
    now: new Date("2026-09-25T00:00:00+07:00"),
    to: new Date("2026-10-30T00:00:00+07:00"),
  };
  const base = {
    "@type": "Event",
    startDate: "2026-09-27T10:00:00+07:00",
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
  };
  const anon = filterEvents(
    [{ raw: { ...base, name: "Virtual Book Club", url: "https://x/1" }, source: "eventbrite" }],
    window,
  );
  assert.equal(anon.events.length, 0, "a global webinar naming nobody is noise");
  assert.equal(anon.dropped.online, 1);

  const named = filterEvents(
    [{
      raw: { ...base, name: "Speak English Online", url: "https://x/2",
             organizer: { name: "Indo-Japan Kai", url: "https://meetup.com/ijk" } },
      source: "meetup",
    }],
    window,
  );
  assert.equal(named.events.length, 1, "an online organiser is still a referral lead");
  assert.equal(named.events[0].online, true);
});

test("csv opens in Excel: BOM, CRLF, quoted commas, Thai intact", () => {
  const csv = toCsv([
    {
      source: "meetup",
      name: "งานเลี้ยง",
      url: "https://x/1",
      startUtc: "2026-09-24T11:00:00.000Z",
      startLocal: "2026-09-24 18:00",
      online: false, lat: null, lng: null,
      startPrecision: "datetime",
      end: null,
      venue: 'The "Edge"',
      address: "17 Moonmuang Rd, Si Phum, Chiang Mai",
      organizer: null,
      organizerUrl: null,
    },
  ]);
  assert.ok(csv.startsWith("﻿"), "BOM present or Excel mangles Thai");
  assert.ok(csv.includes("งานเลี้ยง"));
  assert.ok(csv.includes('"17 Moonmuang Rd, Si Phum, Chiang Mai"'), "commas quoted");
  assert.ok(csv.includes('"The ""Edge"""'), "inner quotes doubled");
  assert.ok(csv.includes("\r\n"));
  assert.equal(csv.split("\r\n")[1].split(",").length > 0, true);
});

test("csv emits a header even with no rows", () => {
  assert.ok(toCsv([]).includes("name,start_local,organizer"));
});

test("a bare date keeps date precision and never invents midnight", () => {
  const p = parseStart("2026-09-27")!;
  assert.equal(p.precision, "date");
  assert.equal(toLocal(p.at, p.precision), "2026-09-27");
});

test("a non-string eventAttendanceMode does not throw", () => {
  const hybrid = {
    "@type": "Event",
    name: "Hybrid",
    url: "https://x/2",
    startDate: "2026-09-25T10:00:00.000Z",
    eventAttendanceMode: [
      "https://schema.org/OfflineEventAttendanceMode",
      "https://schema.org/OnlineEventAttendanceMode",
    ],
    location: { name: "Somewhere" },
  };
  assert.doesNotThrow(() => normalize(hybrid));
  assert.equal(normalize(hybrid).online, true);
});

test("an hour-only ISO offset parses instead of vanishing", () => {
  const p = parseStart("2026-09-27T19:00:00+07")!;
  assert.ok(p, "+07 must not produce Invalid Date");
  assert.equal(toLocal(p.at, p.precision), "2026-09-27 19:00");
});

test("location published as plain text is kept as the address", () => {
  const e = normalize({
    "@type": "Event", name: "Founders Dinner", url: "https://x/1",
    startDate: "2026-09-27", location: "Sukhumvit Soi 11, Bangkok",
  }).event;
  assert.equal(e.address, "Sukhumvit Soi 11, Bangkok");
});

test("a hybrid event keeps its real venue, not the VirtualLocation", () => {
  const e = normalize({
    "@type": "Event", name: "Hybrid", url: "https://x/2", startDate: "2026-09-27",
    location: [
      { "@type": "VirtualLocation", url: "https://zoom.us/j/1" },
      { "@type": "Place", name: "The Commons", address: { streetAddress: "335 Thonglor" } },
    ],
  }).event;
  assert.equal(e.venue, "The Commons");
  assert.equal(e.address, "335 Thonglor");
});

test("two same-day sessions of one date-only listing both survive", () => {
  const session = (endDate: string) => ({
    raw: {
      "@type": "Event", name: "Street Food Tour", url: "https://eb/tour",
      startDate: "2026-09-27", endDate, location: { name: "Talad Noi" },
    },
    source: "eventbrite" as const,
  });
  const { events } = filterEvents([session("2026-09-27T12:00"), session("2026-09-27T20:00")], {
    now: new Date("2026-09-25T00:00:00+07:00"),
    to: new Date("2026-10-30T00:00:00+07:00"),
  });
  assert.equal(events.length, 2);
});

test("Excel formula characters are neutralised, so a phone number stays a phone number", () => {
  const csv = toCsv([{
    source: "meetup", name: "n", url: "u", startUtc: "", startLocal: "2026-09-27",
    startPrecision: "date", end: null, online: false, lat: null, lng: null, venue: "=Escape Hunt",
    address: "+66 2 656 1000", organizer: null, organizerUrl: null,
  }]);
  const row = csv.split("\r\n")[1];
  assert.ok(!/,=Escape/.test(row), "a leading = must not reach Excel bare");
  assert.ok(!/,\+66/.test(row), "a leading + must not reach Excel bare");
  assert.ok(row.includes("Escape Hunt") && row.includes("66 2 656 1000"), "content survives");
});

test("one event served under two country domains is a single lead", () => {
  const listing = (host: string) => ({
    raw: {
      "@type": "Event", name: "AI for Women", startDate: "2026-09-28",
      url: `https://www.${host}/e/ai-for-women-tickets-123`,
      location: { name: "4Seas Nimman", address: { streetAddress: "20 Nimmanahaeminda Rd" } },
    },
    source: "eventbrite" as const,
  });
  const { events, dropped } = filterEvents(
    [listing("eventbrite.com"), listing("eventbrite.sg")],
    { now: new Date("2026-09-25T00:00:00+07:00"), to: new Date("2026-10-30T00:00:00+07:00") },
  );
  assert.equal(events.length, 1, "same path, different TLD is the same event");
  assert.equal(dropped.duplicate, 1);
});

test("one event under two domains is a single lead, and case-different ids are not", () => {
  const win = { now: new Date("2026-09-25T00:00:00+07:00"), to: new Date("2026-10-30T00:00:00+07:00") };
  const at = (url: string) => ({
    raw: { "@type": "Event", name: "E", startDate: "2026-09-28", url, location: { name: "V" } },
    source: "luma" as const,
  });
  assert.equal(filterEvents([at("https://lu.ma/e/abc"), at("https://luma.com/e/abc")], win).events.length, 1);
  assert.equal(filterEvents([at("https://lu.ma/K3mQz9"), at("https://lu.ma/k3mqz9")], win).events.length, 2);
});

test("a blank or out-of-range coordinate yields no pin", () => {
  const geo = (g: unknown) =>
    normalize({ "@type": "Event", name: "E", url: "https://x/1", startDate: "2026-09-28",
                location: { name: "V", geo: g } }).event;
  assert.equal(geo({ latitude: "", longitude: "100.52" }).lat, null, "blank latitude is not 0N");
  assert.equal(geo({ latitude: 999, longitude: 100 }).lat, null, "out of range");
  assert.equal(geo({ latitude: 0, longitude: 0 }).lat, null, "null island is missing, not a place");
  assert.equal(geo({ latitude: "18.7135", longitude: "98.9188" }).lat, 18.7135, "strings parse");
});

test("coordinates come from the same entry as the venue name", () => {
  const e = normalize({
    "@type": "Event", name: "E", url: "https://x/2", startDate: "2026-09-28",
    location: [
      { "@type": "Place", name: "Nimman Coworking", address: { streetAddress: "Chiang Mai" } },
      { "@type": "Place", name: "Bangkok HQ", geo: { latitude: 13.7563, longitude: 100.5018 } },
    ],
  }).event;
  assert.equal(e.venue, "Nimman Coworking");
  assert.equal(e.lat, null, "must not borrow the other entry's pin");
});

test("extracts Event subtypes, not just a bare Event", () => {
  const html = `<script type="application/ld+json">${JSON.stringify([
    { "@type": "MusicEvent", name: "Gig", startDate: "2026-09-27T18:30:00" },
    { "@type": "https://schema.org/TheaterEvent", name: "Play", startDate: "2026-09-28T19:00:00" },
    { "@type": "Organization", name: "Not an event" },
  ])}</script>`;
  assert.deepEqual(
    extractEvents(html).map((e) => e.name),
    ["Gig", "Play"],
  );
});

test("rejects a venue outside the city, however the source labels it", () => {
  const pai = {
    "@type": "Event",
    name: "Retreat in Pai",
    startDate: "2026-09-28T10:00:00+07:00",
    location: {
      "@type": "Place",
      name: "The Nest Pai",
      // allevents stamps the city on every address, so only the geo gives it away.
      address: "Pai, Mae Hong Son, Chiang Mai, CM",
      geo: { latitude: 19.3583, longitude: 98.4406 },
    },
  };
  const opts = {
    now: new Date("2026-09-26T00:00:00+07:00"),
    to: new Date("2026-10-03T23:59:59+07:00"),
    centre: { lat: 18.7883, lng: 98.9853, radiusKm: 75 },
  };
  const out = filterEvents([{ raw: pai, source: "allevents" }], opts);
  assert.equal(out.events.length, 0);
  assert.equal(out.dropped.farAway, 1);
  // Without a centre the same event is kept: the rule is opt-in, not a silent global.
  assert.equal(filterEvents([{ raw: pai, source: "allevents" }], { now: opts.now, to: opts.to }).events.length, 1);
});
