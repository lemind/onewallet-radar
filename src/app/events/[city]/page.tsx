import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CITIES, findCity } from "../../../lib/cities.ts";
import { CITY_COPY } from "../../../lib/city-copy.ts";
import { runCity } from "../../../lib/run.ts";
import { SITE, BRAND, BRAND_SITE } from "../../../lib/site.ts";
import { toLocal } from "../../../lib/time.ts";
import type { CityId, Event } from "../../../types.ts";

// Rebuilt hourly: a crawler must get the events as HTML, and scraping six
// sources per request is far too slow to do on the fly.
export const revalidate = 3600;

export function generateStaticParams() {
  return CITIES.map((c) => ({ city: c.id }));
}

const WINDOW_DAYS = 30;

function window(): { from: string; to: string } {
  const now = new Date();
  return {
    from: toLocal(now, "date"),
    to: toLocal(new Date(now.getTime() + WINDOW_DAYS * 86_400_000), "date"),
  };
}

async function load(city: CityId): Promise<Event[]> {
  const { from, to } = window();
  try {
    return (await runCity(city, from, to)).events;
  } catch {
    // A page that renders without listings is still a page; failing the build is not.
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const city = findCity((await params).city);
  if (!city) return {};
  // Absolute, so the site-wide template does not push it past what Google shows.
  const title = `Events in ${city.label} — Venues & Organizers | ${BRAND}`;
  const description =
    `Upcoming events in ${city.label}, Thailand: concerts, club nights, festivals, ` +
    `markets, workshops and meetups, with the venue and organizer behind each one.`;
  const url = `${SITE}/events/${city.id}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `/events/${city.id}` },
    openGraph: { title, description, url, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

function eventLd(e: Event, city: string) {
  return {
    "@type": "Event",
    name: e.name,
    startDate: e.startUtc || undefined,
    eventAttendanceMode: e.online
      ? "https://schema.org/OnlineEventAttendanceMode"
      : "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    url: e.url || undefined,
    location: e.online
      ? { "@type": "VirtualLocation", url: e.url || undefined }
      : {
          "@type": "Place",
          name: e.venue ?? city,
          address: e.address ?? `${city}, Thailand`,
          ...(e.lat != null && e.lng != null
            ? { geo: { "@type": "GeoCoordinates", latitude: e.lat, longitude: e.lng } }
            : {}),
        },
    ...(e.organizer ? { organizer: { "@type": "Organization", name: e.organizer } } : {}),
  };
}

export default async function CityEvents({ params }: { params: Promise<{ city: string }> }) {
  const city = findCity((await params).city);
  if (!city) notFound();

  const events = await load(city.id);
  const { from, to } = window();
  const venues = [...new Set(events.map((e) => e.venue).filter(Boolean))] as string[];
  const organizers = [...new Set(events.map((e) => e.organizer).filter(Boolean))] as string[];
  const others = CITIES.filter((c) => c.id !== city.id);
  const copy = CITY_COPY[city.id];

  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE },
          {
            "@type": "ListItem",
            position: 2,
            name: `Events in ${city.label}`,
            item: `${SITE}/events/${city.id}`,
          },
        ],
      },
      {
        "@type": "ItemList",
        name: `Upcoming events in ${city.label}`,
        numberOfItems: events.length,
        itemListElement: events.slice(0, 60).map((e, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: eventLd(e, city.label),
        })),
      },
    ],
  };

  return (
    <main className="wrap">
      <nav className="crumbs">
        <Link href="/">{BRAND} Radar</Link> <span aria-hidden>›</span> Events in {city.label}
      </nav>

      <h1>Events in {city.label}</h1>
      <p className="sub">
        Everything happening in {city.label}, Thailand between {from} and {to} — concerts, club
        nights, festivals, markets, workshops and meetups — together with the venue hosting each one
        and the organizer running it. Updated hourly from six listing sources.
      </p>

      <p className="note">
        <strong>{events.length}</strong> upcoming {events.length === 1 ? "event" : "events"} ·{" "}
        <strong>{venues.length}</strong> {venues.length === 1 ? "venue" : "venues"} ·{" "}
        <strong>{organizers.length}</strong> {organizers.length === 1 ? "organizer" : "organizers"}.{" "}
        <Link href="/">Search other dates</Link>.
      </p>

      <h2>What the {city.label} event scene looks like</h2>
      <p>{copy.intro}</p>
      <p>{copy.scene}</p>

      <h2>When {city.label} is busiest</h2>
      <p>{copy.when}</p>

      <h2>Upcoming events in {city.label}</h2>
      {events.length === 0 ? (
        <p>No events are listed for {city.label} in this window. Try a wider range on the search page.</p>
      ) : (
        <ol className="evlist">
          {events.map((e) => (
            <li key={`${e.url}-${e.startUtc}`}>
              <h3>
                {e.url ? (
                  <a href={e.url} target="_blank" rel="noreferrer">
                    {e.name}
                  </a>
                ) : (
                  e.name
                )}
              </h3>
              <p className="evmeta">
                <time dateTime={e.startUtc || undefined}>{e.startLocal}</time>
                {e.venue && <> · {e.venue}</>}
                {e.address && <> · {e.address}</>}
                {e.organizer && <> · organized by {e.organizer}</>}
              </p>
            </li>
          ))}
        </ol>
      )}

      {venues.length > 0 && (
        <>
          <h2>Event venues in {city.label}</h2>
          <p>
            These {venues.length} {venues.length === 1 ? "venue is" : "venues are"} hosting events in{" "}
            {city.label} over the next {WINDOW_DAYS} days.
          </p>
          <ul className="taglist">
            {venues.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
        </>
      )}

      {organizers.length > 0 && (
        <>
          <h2>Event organizers in {city.label}</h2>
          <p>
            Promoters, venues and communities currently running events in {city.label}.
          </p>
          <ul className="taglist">
            {organizers.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </>
      )}

      <h2>Events in other Thai cities</h2>
      <ul className="taglist">
        {others.map((c) => (
          <li key={c.id}>
            <Link href={`/events/${c.id}`}>Events in {c.label}</Link>
          </li>
        ))}
      </ul>

      <footer className="foot">
        A lead finder for{" "}
        <a href={BRAND_SITE} target="_blank" rel="noreferrer">
          {BRAND}
        </a>
        .
      </footer>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
    </main>
  );
}
