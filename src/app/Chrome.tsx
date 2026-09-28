import Link from "next/link";
import { BRAND, BRAND_SITE, SITE } from "../lib/site.ts";

/** The footer every page carries. One copy: three had already drifted apart once. */
export function SiteFooter() {
  return (
    <footer className="foot">
      A lead finder for{" "}
      <a href={BRAND_SITE} target="_blank" rel="noreferrer">
        {BRAND}
      </a>
      .
    </footer>
  );
}

/** One step of a trail. Every step has a path; the last is the page you are on. */
export type Crumb = { name: string; href: string };

/**
 * The visible trail, with the current page as plain text. Google drops the rich
 * result when BreadcrumbList disagrees with the rendered crumbs, so the two are
 * built from the same array — see crumbLd.
 */
export function Crumbs({ trail }: { trail: Crumb[] }) {
  return (
    <nav className="crumbs">
      {trail.map((c, i) => (
        <span key={c.href}>
          {i > 0 && <span aria-hidden> › </span>}
          {i === trail.length - 1 ? c.name : <Link href={c.href}>{c.name}</Link>}
        </span>
      ))}
    </nav>
  );
}

/** The same trail as schema.org. "/" resolves to the bare origin, which is the canonical. */
export function crumbLd(trail: Crumb[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.href === "/" ? SITE : `${SITE}${c.href}`,
    })),
  };
}
