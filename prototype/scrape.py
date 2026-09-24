#!/usr/bin/env python3
"""Scrape upcoming events for a Thai city from Meetup + Eventbrite.

Stdlib only. Outputs a normalized JSON array to stdout or --out.
"""
import argparse, gzip, json, re, sys, urllib.request, urllib.error
from datetime import datetime, timedelta, timezone

UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

# Each city needs its own slug per platform; they don't share a format.
CITIES = {
    "chiang-mai": {"meetup": "th--Chiang-Mai", "eventbrite": "thailand--chiang-mai"},
    "bangkok":    {"meetup": "th--Bangkok",    "eventbrite": "thailand--bangkok"},
    "phuket":     {"meetup": "th--Phuket",     "eventbrite": "thailand--phuket"},
}


def fetch(url, timeout=25):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip",
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    return raw.decode("utf-8", errors="ignore")


def _json_objects_containing(html, needle):
    """Yield balanced JSON objects that contain `needle`, scanning outward."""
    i = 0
    while True:
        hit = html.find(needle, i)
        if hit < 0:
            return
        depth, start = 0, None
        for j in range(hit, max(0, hit - 6000), -1):
            c = html[j]
            if c == "}":
                depth += 1
            elif c == "{":
                if depth == 0:
                    start = j
                    break
                depth -= 1
        if start is None:
            i = hit + 1
            continue
        depth = 0
        end = None
        for k in range(start, min(len(html), start + 12000)):
            c = html[k]
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    end = k
                    break
        if end is None:
            i = hit + 1
            continue
        try:
            yield json.loads(html[start:end + 1])
        except ValueError:
            pass
        i = end + 1


def _ld_json_events(html):
    for block in re.findall(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', html, re.S):
        try:
            data = json.loads(block.strip())
        except ValueError:
            continue
        for item in (data if isinstance(data, list) else [data]):
            if isinstance(item, dict) and item.get("@type") == "Event":
                yield item


def _flat_address(loc):
    if not isinstance(loc, dict):
        return None, None
    addr = loc.get("address")
    if isinstance(addr, dict):
        parts = [addr.get(k) for k in
                 ("streetAddress", "addressLocality", "addressRegion", "postalCode")]
        addr = ", ".join(p for p in parts if p)
    return loc.get("name"), (addr or None)


def _norm(ev, source):
    loc = ev.get("location")
    if isinstance(loc, list):
        loc = loc[0] if loc else {}
    venue, address = _flat_address(loc)
    org = ev.get("organizer")
    if isinstance(org, list):
        org = org[0] if org else {}
    organizer = org.get("name") if isinstance(org, dict) else (org or None)
    return {
        "source": source,
        "name": (ev.get("name") or "").strip() or None,
        "start": ev.get("startDate"),
        "end": ev.get("endDate"),
        "venue": venue,
        "address": address,
        "organizer": organizer,
        "url": ev.get("url"),
        "online": ev.get("eventAttendanceMode", "").endswith("OnlineEventAttendanceMode"),
    }


def scrape_meetup(slug):
    html = fetch(f"https://www.meetup.com/find/?location={slug}&source=EVENTS")
    return [_norm(e, "meetup") for e in _ld_json_events(html)]


def scrape_eventbrite(slug):
    html = fetch(f"https://www.eventbrite.com/d/{slug}/events/")
    out = [_norm(o, "eventbrite") for o in _json_objects_containing(html, '"@type":"Event"')]
    return out


def parse_start(s):
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def clean(events, days):
    """Drop online/venueless/undated events, keep the next `days`, dedupe."""
    now = datetime.now(timezone.utc)
    horizon = now + timedelta(days=days)
    kept, seen, stats = [], set(), {"online": 0, "no_venue": 0, "no_date": 0, "out_of_range": 0, "dupe": 0}
    for e in events:
        dt = parse_start(e["start"])
        if e["online"]:
            stats["online"] += 1; continue
        if not (e["venue"] or e["address"]):
            stats["no_venue"] += 1; continue
        if not dt:
            stats["no_date"] += 1; continue
        if not (now - timedelta(hours=12) <= dt <= horizon):
            stats["out_of_range"] += 1; continue
        key = (e["source"], e["url"] or e["name"])
        if key in seen:
            stats["dupe"] += 1; continue
        seen.add(key)
        e["start"] = dt.isoformat()
        kept.append(e)
    kept.sort(key=lambda x: x["start"])
    return kept, stats


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default="chiang-mai", choices=sorted(CITIES))
    ap.add_argument("--days", type=int, default=7)
    ap.add_argument("--out")
    args = ap.parse_args()

    slugs = CITIES[args.city]
    raw, errors = [], []
    for name, fn, slug in (("meetup", scrape_meetup, slugs["meetup"]),
                           ("eventbrite", scrape_eventbrite, slugs["eventbrite"])):
        try:
            got = fn(slug)
            raw += got
            print(f"[{name}] fetched {len(got)}", file=sys.stderr)
        except Exception as exc:
            errors.append(f"{name}: {exc}")
            print(f"[{name}] FAILED: {exc}", file=sys.stderr)

    events, stats = clean(raw, args.days)
    payload = {
        "city": args.city,
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "window_days": args.days,
        "count": len(events),
        "dropped": stats,
        "errors": errors,
        "events": events,
    }
    text = json.dumps(payload, ensure_ascii=False, indent=2)
    if args.out:
        open(args.out, "w", encoding="utf-8").write(text)
        print(f"wrote {len(events)} events -> {args.out}  dropped={stats}", file=sys.stderr)
    else:
        print(text)


if __name__ == "__main__":
    main()
