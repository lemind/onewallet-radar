import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BRAND, BRAND_SITE, SITE } from "../lib/site.ts";

// Cities the tool actually covers. Naming them beats a generic "Thailand":
// the searches that matter are city-qualified ("events in Chiang Mai").
const CITIES = ["Bangkok", "Chiang Mai", "Phuket"];

// Title and description are kept inside what search results actually show:
// roughly 60 and 160 characters. The longer wording lives in the OG tags,
// which are rendered by social cards rather than truncated by Google.
const TITLE = `${BRAND} Radar — Events in Bangkok, Chiang Mai, Phuket`;
const SHORT_TITLE = `${BRAND} Radar`;
const DESCRIPTION =
  "Event radar for Bangkok, Chiang Mai and Phuket: upcoming events with the " +
  "venues and organizers behind them, from club nights to festivals.";
const SOCIAL_DESCRIPTION =
  "An event radar for Bangkok, Chiang Mai and Phuket: upcoming events, and the venues, promoters and " +
  "organizers behind them. Concerts, club nights, festivals, workshops, exhibitions, markets " +
  `and meetups, with dates, addresses and a map, exportable as a spreadsheet. Built for ${BRAND}.`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: TITLE, template: `%s | ${SHORT_TITLE}` },
  description: DESCRIPTION,
  applicationName: SHORT_TITLE,
  category: "events",
  // Google ignores meta keywords; kept because other engines and internal search still read it.
  keywords: [
    ...CITIES.flatMap((c) => [
      `events in ${c}`,
      `${c} events`,
      `things to do in ${c}`,
      `what's on in ${c}`,
      `${c} nightlife`,
      `concerts in ${c}`,
    ]),
    "Thailand events",
    "upcoming events Thailand",
    "event venues Thailand",
    "event organizers Thailand",
    "club nights Bangkok",
    "live music Chiang Mai",
    "festivals Thailand",
    "exhibitions Bangkok",
    "workshops Chiang Mai",
    "networking events Bangkok",
    "partner leads",
    "event radar",
    "Thailand event radar",
    "Bangkok event radar",
    "Chiang Mai event radar",
    "radar",
    BRAND,
    SHORT_TITLE,
  ],
  authors: [{ name: BRAND, url: BRAND_SITE }],
  creator: BRAND,
  publisher: BRAND,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SHORT_TITLE,
    title: TITLE,
    description: SOCIAL_DESCRIPTION,
    url: SITE,
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: SOCIAL_DESCRIPTION },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#17171a" },
  ],
};

// WebApplication over WebSite: this is a tool, not a publication, and the
// Organization node is what ties the page to onewallet.co.th for search engines.
const LD_JSON = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE}/#organization`,
      name: BRAND,
      url: BRAND_SITE,
      description:
        "The first all-in-one digital wallet for tourists in Thailand, with PromptPay QR payments and eSIM.",
      sameAs: [
        BRAND_SITE,
        "https://apps.apple.com/app/one-wallet/id6753753149",
        "https://play.google.com/store/apps/details?id=com.thamming.onewallet",
      ],
    },
    {
      "@type": "WebApplication",
      "@id": `${SITE}/#app`,
      name: SHORT_TITLE,
      url: SITE,
      description: SOCIAL_DESCRIPTION,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Any",
      inLanguage: "en",
      isAccessibleForFree: true,
      publisher: { "@id": `${SITE}/#organization` },
      offers: { "@type": "Offer", price: "0", priceCurrency: "THB" },
      about: CITIES.map((c) => ({
        "@type": "City",
        name: c,
        address: { "@type": "PostalAddress", addressLocality: c, addressCountry: "TH" },
      })),
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <script
          type="application/ld+json"
          // Serialised from a literal above, so there is no untrusted input to escape.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(LD_JSON) }}
        />
      </body>
    </html>
  );
}
