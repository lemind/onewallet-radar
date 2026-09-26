# onewallet.co.th — SEO findings

Audited 26 Sep 2026 against the live site. Ordered by cost of leaving it alone.

## What is already right

Worth stating first, because these are the expensive things to retrofit and
they are done: the page is genuinely server-rendered rather than a JavaScript
shell, there is exactly one `h1`, all 17 images carry alt text, and
`robots.txt` permits crawling. Everything below is head-tag work plus one
routing change.

---

## 1. Two of the three languages cannot be indexed

The site offers English, Русский and ภาษาไทย, but `/th`, `/ru` and `/en` all
return 404. The switch happens in JavaScript without changing the URL.

One URL holds one indexed language, so the Thai and Russian versions do not
exist as far as search engines are concerned. For a product sold to tourists
inside Thailand and to a large Russian-speaking audience, this is the most
expensive item on the list by a wide margin.

**Fix:** give each language its own path (`/`, `/th`, `/ru`), and add
reciprocal `hreflang` tags to all three, including `x-default`.

## 2. No `og:image`

There is no Open Graph image, so every share on LINE, Facebook, X or Telegram
renders as a bare grey rectangle. LINE is the dominant sharing channel in
Thailand, which makes this the cheapest high-impact fix available.

**Fix:** one 1200x630 image and one `og:image` tag, plus `og:image:alt`.

## 3. Duplicate and conflicting head tags

    viewport      x3   three different values
    description   x2   two different texts

Google picks one description arbitrarily. The weaker one is currently as
likely to be chosen as the stronger one:

- "Your travel - friendly wallet. Fast, secure, and ready for your next
  adventure." — vague, no search terms
- "The first all-in-one digital wallet for tourists. Access PromptPay QR
  payments, instant eSIM, and exclusive travel deals." — names the things
  people actually search for

Three competing viewport tags is also a mobile rendering risk.

**Fix:** delete the weaker description and keep the second; reduce viewport to
a single tag.

## 4. The brand name is missing from the title

    <title>        Pay like a Local, Explore like a Pro
    og:title       Your Travel Wallet
    og:site_name   Your Travel Wallet
    author         OneWallet

Nobody searching "one wallet thailand" matches a tagline-only title, and
`og:site_name` names something that is not the brand. Note also that the site
spells the brand "One Wallet" in body copy and "OneWallet" in the author tag;
the App Store slug is `one-wallet`.

**Fix:** lead the title with the brand, keep the tagline second, and settle on
one spelling everywhere.

## 5. No sitemap and no canonical

`sitemap.xml` returns 404 and `robots.txt` does not reference one, so discovery
depends entirely on crawling. The absence of a canonical leaves the site open
to duplicate-URL splits from tracking parameters.

**Fix:** publish `sitemap.xml`, reference it from `robots.txt`, add a
self-referencing canonical to every page.

## 6. No structured data

Zero `ld+json` blocks. There is no `Organization` node tying the domain to the
brand, and no `MobileApplication` node tying it to the App Store and Play
listings. This is what drives a brand panel and app rich results.

**Fix:** add an `Organization` node with `sameAs` pointing at both store
listings, and a `MobileApplication` node per platform.

---

## Suggested order

1. og:image — an afternoon, immediate effect on every shared link
2. Deduplicate viewport and description — minutes
3. Brand in the title — minutes
4. Canonical and sitemap — an hour
5. Structured data — half a day
6. Per-language URLs and hreflang — the real project, and the one that matters
