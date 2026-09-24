<!-- SPECKIT START -->
**Active plan**: feature 001 — event lead finder. Nothing is implemented yet; T004 is a
gate that can still invalidate the architecture (does Meetup serve Vercel's datacenter IPs?).

- SPEC.md — **source of truth**. Where it and a spec artifact disagree, SPEC.md wins.
- specs/001-event-lead-finder/plan.md — implementation plan
- specs/001-event-lead-finder/tasks.md — task breakdown, 43 tasks
- specs/001-event-lead-finder/research.md — decisions D1–D7, open items O1–O3
<!-- SPECKIT END -->

## Conventions

**Commit messages**: one line, `feat|fix|chore|docs|test(T0XX): <short desc>`. Omit `(T0XX)` when the commit isn't task-scoped. Never commit without an explicit request.

**No AI attribution** in commits or PRs — no `Co-Authored-By`, no "Generated with", no mention. This is client-facing work.

**PR descriptions**: plain human language. No file paths, line numbers, identifiers or finding counts. Describe what changed for a person, not what changed in the diff.

**Code comments: max ~200 chars, one line.** State what or why, then point at the decision — `SPEC.md §9.4`, `research.md D2`. Never restate rationale inline. If a comment needs a second line to justify itself, that justification belongs in the spec.

**Minimum tests — a cap, not a floor.** Four test files, listed in plan.md: parser, normalize, time, csv. That is the whole intended suite. Do not add a test to raise a number, and do not test the UI or glue code.

The reason there is a hard ceiling: the fixture *is* the regression signal. `tests/fixtures/meetup-chiang-mai.html` plus `prototype/chiang-mai.expected.json` pin the port to a real 24 Sep run — 12 events kept, dropped 18/0/0/3/3. Any hand-written case that doesn't touch parsing, filtering, time or CSV encoding is duplicating what the fixture already proves, on a two-day build.

Add a test only when the bug is in the four modules above. A UI bug gets fixed, not covered.

**Scraper quirks get tagged.** Code that exists because of a Meetup or Places quirk — not general correctness — is marked inline:

```ts
// HACK(meetup): endDate ships as "" not null. Observed 24 Sep fixture, 12/12 events.
// REVISIT: drop if a later fixture shows real null.
```

Before changing any source or parser assumption, `grep -rn "HACK(" src/` and re-check every hit. Delete anything whose REVISIT condition fired with no evidence behind it. Untagged defensive branches accumulate and nobody revisits them.

## Hard rules from the spec

These are invariants, not preferences. Breaking one is a bug even if tests pass.

- **Never export UTC.** Meetup publishes `11:00Z` for a 6pm event. Store `startUtc`, render `startLocal` in `Asia/Bangkok`. (§7.1)
- **Never invent a time.** A date-only source exports an empty time cell, never `00:00`.
- **Enrichment is all-or-nothing.** An unmatched venue gets null district, phone and website — never a partial fill. A wrong phone number is worse than a missing one. (§9.9)
- **Every row carries its source URL.** No exceptions; it is the traceability guarantee.
- **Degrade, don't fail.** Places failing returns events plus `errors[]`. Only Meetup being unreachable fails a run. (§9.11)
- **CSV is UTF-8 with BOM** or Excel corrupts every Thai venue name.
- **Port the prototype; don't improve it.** `prototype/scrape.py` is proven against live pages. Translate it, make the fixtures pass, then restructure if there's a reason.
