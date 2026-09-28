/** Public origin and brand links. One copy: a custom domain must not leave a stale canonical behind. */
export const SITE = "https://onewallet-radar.vercel.app";
export const BRAND = "One Wallet";
export const BRAND_SITE = "https://onewallet.co.th/";
/** Alt text for the generated social card, shared by the image route and the pages that name it. */
export const OG_ALT = "One Wallet Radar — event, venue and organizer leads in Thailand";

/**
 * The generated social card, named wherever a page declares its own openGraph
 * block — doing that drops the image Next would otherwise inherit. Bump `v`
 * when the card design changes: social scrapers cache og:image by URL forever.
 */
export const OG_IMAGE = { url: "/opengraph-image?v=1", width: 1200, height: 630, alt: OG_ALT };
export const OG_IMAGES = [OG_IMAGE];
