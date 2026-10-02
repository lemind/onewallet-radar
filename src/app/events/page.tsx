import type { Metadata } from "next";
import Link from "next/link";
import { CITIES } from "../../lib/cities.ts";
import { CITY_COPY } from "../../lib/city-copy.ts";
import { ldScript } from "../../lib/jsonld.ts";
import { SITE, BRAND, OG_IMAGES } from "../../lib/site.ts";
import { Crumbs, SiteFooter, crumbLd, type Crumb } from "../Chrome.tsx";

// Static: the hub links to the city pages rather than listing events, so
// there is nothing here that goes stale within a day.
export const revalidate = 86400;

const TITLE = `Events in Thailand — Bangkok, Chiang Mai, Phuket | ${BRAND}`;
const DESCRIPTION =
  "Upcoming events across Thailand's three biggest event cities, with the venue " +
  "hosting each one and the organizer running it. Updated hourly.";

export function generateMetadata(): Metadata {
  return {
    title: { absolute: TITLE },
    description: DESCRIPTION,
    alternates: { canonical: "/events" },
    openGraph: {
      title: TITLE,
      description: DESCRIPTION,
      url: `${SITE}/events`,
      type: "website",
      images: OG_IMAGES,
    },
    twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: OG_IMAGES },
  };
}

// CollectionPage over WebPage: this page exists to lead to the three city
// pages, and the ItemList is what states that relationship.
const TRAIL: Crumb[] = [
  { name: `${BRAND} Radar`, href: "/" },
  { name: "Events in Thailand", href: "/events" },
];

const LD = {
  "@context": "https://schema.org",
  "@graph": [
    crumbLd(TRAIL),
    {
      "@type": "CollectionPage",
      "@id": `${SITE}/events`,
      name: "Events in Thailand",
      description: DESCRIPTION,
      inLanguage: "en",
      isPartOf: { "@id": `${SITE}/#app` },
      publisher: { "@id": `${SITE}/#organization` },
      about: {
        "@type": "Country",
        name: "Thailand",
        address: { "@type": "PostalAddress", addressCountry: "TH" },
      },
      mainEntity: {
        "@type": "ItemList",
        name: "Thai cities covered",
        numberOfItems: CITIES.length,
        itemListElement: CITIES.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: `Events in ${c.label}`,
          url: `${SITE}/events/${c.id}`,
        })),
      },
    },
  ],
};

export default function EventsHub() {
  return (
    <main className="wrap">
      <div className="content prose">
        <Crumbs trail={TRAIL} />

        <h1>Events in Thailand</h1>
        <p className="sub">
          What's on in Bangkok, Chiang Mai and Phuket over the next 30 days — concerts, club
          nights, festivals, markets, workshops and meetups — with the venue hosting each one and
          the organizer running it.
        </p>

        <h2>Pick a city</h2>
        <ul className="hublist">
          {CITIES.map((c) => (
            <li key={c.id}>
              <h3>
                <Link href={`/events/${c.id}`}>Events in {c.label}</Link>
              </h3>
              <p>{CITY_COPY[c.id].teaser}</p>
            </li>
          ))}
        </ul>

        <h2>Why these three cities</h2>
        <p>
          Bangkok, Chiang Mai and Phuket account for most of Thailand's published event listings,
          and each one runs a different kind of calendar: a two-sided capital where promoters and
          convention centres barely overlap, a northern city whose busiest events fall on weekday
          afternoons, and an island whose season tracks the flight schedule. A partner list built
          from one of them will not describe the other two.
        </p>

        <h2>Where the listings come from</h2>
        <p>
          Every event here was published by a public listing site — Meetup, Eventbrite, Luma,
          AllEvents and Resident Advisor among them — and each one keeps a link back to the source
          it came from. Nothing is written by hand and no time is ever guessed: an event whose
          organizer published a date but no start time is shown as a date.
        </p>

        <h2>What it is for</h2>
        <p>
          The point is not the events themselves but the businesses behind them. A venue hosting
          four nights a month and a promoter filling it are both worth a conversation, and neither
          appears on a directory. <Link href="/">Search a date range</Link> to pull a city's
          listings with the venues, organizers and addresses attached, and export the result as a
          spreadsheet.
        </p>
      </div>

      <SiteFooter />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript(LD) }} />
    </main>
  );
}
