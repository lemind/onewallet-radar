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
