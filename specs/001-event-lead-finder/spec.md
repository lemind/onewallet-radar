# Feature Specification: Event-Sourced Partner Lead Finder

**Feature Branch**: `001-event-lead-finder`

**Created**: 2026-09-24

**Status**: Draft

**Input**: User description: "Find partner leads in Thai cities by scraping upcoming events, enriching venues, and exporting a CSV of venue and organizer leads"

**Source of truth**: `SPEC.md` v0.2.1 at the repository root holds the approved
requirements, the measured constraints behind them, and the decision history.
This document restates that material in Spec Kit form. Where the two differ,
`SPEC.md` wins and this file should be corrected.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Get this week's leads for a city (Priority: P1)

A business development team member opens the tool on Monday morning, selects a
city and a date range covering the coming week, and presses Run. Within a few
seconds they see the upcoming events in that city, each showing where it is held
and who runs it. They download the list as a spreadsheet and work through it.

**Why this priority**: This is the entire product. Without it there is no tool.
Everything else on this list improves a list that this story already delivers.
It replaces the manual, city-by-city research the team does today.

**Independent Test**: Select Chiang Mai and a 7-day range, press Run, and
confirm a spreadsheet downloads containing that week's events with a venue name
and an organizer name on each row. Delivers a usable weekly prospect list with
nothing else built.

**Acceptance Scenarios**:

1. **Given** a city and a date range covering the next 7 days, **When** the user
   presses Run, **Then** a list of upcoming physical events in that city is
   displayed, each with a name, a local start time, a venue and a source link.
2. **Given** a displayed result set, **When** the user downloads the
   spreadsheet, **Then** it opens in Excel with Thai characters intact and one
   row per event.
3. **Given** a result set, **When** the user inspects any row, **Then** the
   organizer of that event is shown whenever the source publishes one.
4. **Given** a date range with no events, **When** the user presses Run,
   **Then** an explicit "no events found" state is shown — not an empty screen
   and not an error.

---

### User Story 2 - Trust each lead before acting on it (Priority: P2)

Before contacting a business, the team member needs to know where the
information came from and whether it was verified. Every row links back to the
page it was taken from, and any detail the system could not confirm is left
visibly blank rather than guessed.

**Why this priority**: The output drives phone calls to real businesses. A
plausible-looking wrong number costs the team a call and a little credibility.
Traceability is what makes the list safe to act on, so it ships immediately
after the list itself.

**Independent Test**: Inspect any result row and confirm it carries a working
link to its source page. Force an unverifiable venue and confirm the contact
columns are empty and the row is marked unverified, rather than filled with a
near-match.

**Acceptance Scenarios**:

1. **Given** any event in the result set, **When** the user opens its source
   link, **Then** the original event listing is reachable and shows that event.
2. **Given** a venue that cannot be confidently identified, **When** results are
   displayed, **Then** the district, phone and website columns are empty for
   that row and the row is marked as unverified.
3. **Given** a venue that is confidently identified, **When** results are
   displayed, **Then** the row is marked as verified.
4. **Given** an event whose published start has no time of day, **When** it is
   displayed or exported, **Then** the date is shown with an empty time — never
   a fabricated midnight.

---

### User Story 3 - Contact details attached to each lead (Priority: P3)

Rather than looking each venue up by hand, the team member sees the district,
phone number and website alongside each event, so the spreadsheet is directly
workable and can be sorted by area.

**Why this priority**: This turns a list of names into a list a person can act
on without a second research pass. It is deliberately last because it is the
only part requiring a paid external service — the tool is useful without it,
with those columns simply empty.

**Independent Test**: Run a search with enrichment enabled and confirm district,
phone and website are populated for venues that are confidently identified, and
that sorting the spreadsheet by district groups leads by area.

**Acceptance Scenarios**:

1. **Given** a confidently identified venue, **When** results are displayed,
   **Then** its district, phone number and website are shown where published.
2. **Given** the enrichment service is unavailable, **When** the user presses
   Run, **Then** the event list is still returned with those columns empty and a
   warning explaining what is missing.
3. **Given** a downloaded spreadsheet, **When** the user sorts by district,
   **Then** leads are grouped by area.

---

### User Story 4 - Runs cannot be spent by strangers (Priority: P3)

Once a Run can spend money, the tool is not reachable by whoever holds the URL.

**Why this priority**: The trigger is **cost, not privacy**. Until the place
lookup is wired in, a Run spends nothing — it fetches one public listing page
that anyone could open directly — so there is nothing to protect and a login
would only stand between the team and the tool. This ships **with** the lookup
service, not before it.

**Independent Test**: With the lookup key configured, confirm a stranger holding
the URL cannot trigger a billable run.

**Acceptance Scenarios**:

1. **Given** the tool before any lookup key exists, **When** a team member opens
   the URL, **Then** they reach the search page with no account and no password.
2. **Given** the tool after a lookup key is configured, **When** someone outside
   the team opens the URL, **Then** they cannot trigger a billable run.

---

### Edge Cases

- **No events in range** — an explicit empty state naming the city and range, so
  the user can tell "nothing on" apart from "something broke".
- **Event source unreachable** — the run fails with a clear message. Nothing is
  invented and no stale result is presented as current.
- **Enrichment unavailable or rate-limited** — events are still returned with
  empty enrichment columns plus a warning. A failure here never discards the
  event list.
- **Online-only events surfacing under a city** — excluded. Roughly half of raw
  results are online events that leak into city searches.
- **Event with no venue and no address** — excluded; it cannot produce a lead.
- **Ambiguous venue name** (e.g. two businesses with similar names) — treated as
  unverified; no contact details attached.
- **The same event listed twice** — appears once.
- **Date range partly or wholly in the past** — only events from the current
  moment forward are returned.
- **Very wide date range** — accepted, but the user is told that coverage beyond
  a few weeks ahead is thin because sources publish close to the date.
- **City with little activity** — a near-empty result is a correct answer, not a
  malfunction, and the empty state says so.
- **Thai-language venue and event names** — preserved exactly, on screen and in
  the exported file.

## Requirements *(mandatory)*

### Functional Requirements

**Search**

- **FR-001**: Users MUST be able to select a city from a fixed list of supported
  cities.
- **FR-002**: Users MUST be able to select a start and end date for the search.
- **FR-003**: The system MUST return only events taking place at a physical
  location within the selected city.
- **FR-004**: The system MUST exclude online-only events.
- **FR-005**: The system MUST exclude events with neither a venue name nor an
  address.
- **FR-006**: The system MUST exclude events whose start falls outside the
  selected date range, and events already past.
- **FR-007**: The system MUST return each distinct event only once.
- **FR-008**: The system MUST order results by start date, earliest first.

**Lead content**

- **FR-009**: Each result MUST carry the event name, its start, its venue name
  and a link to the source listing.
- **FR-010**: Each result MUST carry the organizer's name and a link to the
  organizer wherever the source publishes them.
- **FR-011**: Each result MUST carry the venue's district, phone number and
  website where these can be confidently determined.
- **FR-012**: The system MUST NOT attach any contact detail to a venue it cannot
  confidently identify; such rows MUST be left empty and marked unverified.
- **FR-013**: The system MUST make each row's verification state visible to the
  user.

**Time**

- **FR-014**: The system MUST display and export all event times in Thailand
  local time.
- **FR-015**: The system MUST NOT invent a time of day for a source that
  publishes only a date.

**Output**

- **FR-016**: Users MUST be able to download the result set as a spreadsheet
  file, one row per event.
- **FR-017**: The downloaded file MUST open in common spreadsheet software with
  Thai characters displayed correctly.
- **FR-018**: The downloaded file MUST contain every field shown on screen, so
  the spreadsheet is self-sufficient.

**Reliability and access**

- **FR-019**: The system MUST return the event list even when enrichment fails,
  accompanied by a warning stating what is unavailable.
- **FR-020**: The system MUST report a clear failure, and invent nothing, when
  the event source itself is unreachable.
- **FR-021**: The system MUST distinguish "no events found" from "the search
  failed" in what it shows the user.
- **FR-022**: The system MUST prevent strangers from triggering billable runs
  once an external lookup key is configured. Before that point it MUST NOT
  require any sign-in.

**Cost control**

- **FR-023**: The system MUST avoid repeating a paid lookup for a venue it has
  already identified recently.

### Key Entities

- **Event** — something happening at a place and time in a selected city. Holds
  a name, a start, an end where published, a link to its source listing, and its
  verification state. The unit of output: one event, one row.
- **Venue** — where an event is held, and the first of the two leads an event
  produces. Holds a name, an address, and — once confidently identified — a
  district, phone number and website. A merchant prospect.
- **Organizer** — who runs an event, and the second lead. Holds a name and a
  link. Has a standing audience of expats and nomads, making them a referral
  channel rather than a merchant. One organizer commonly runs several events, so
  organizer identity is what groups rows together.
- **Search** — a city and a date range, producing a result set plus any warnings
  raised while assembling it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A team member can go from opening the tool to a downloaded
  spreadsheet in under 30 seconds, without training or documentation.
- **SC-002**: A weekly search of a supported city returns at least 10 usable
  leads, where usable means a physical event with an identifiable venue.
- **SC-003**: At least 70% of returned events carry an organizer, giving the
  team a referral contact as well as a merchant one.
- **SC-004**: Zero rows carry contact details belonging to a different business
  than the one named — an unverified row is always preferred to a wrong one.
- **SC-005**: 100% of rows link to a source page a person can open to check the
  event exists.
- **SC-006**: Every event time shown or exported matches the time published on
  the source page, read as Thailand local time.
- **SC-007**: A failure of the enrichment service still yields a complete event
  list, with the loss explained.
- **SC-008**: The research the team does manually for one city — currently
  measured in hours — completes in under a minute.
- **SC-009**: A person outside the team who holds the URL cannot run a search.

## Assumptions

- **Supported cities are Chiang Mai, Bangkok and Phuket.** Measured coverage
  elsewhere approaches zero, because provincial Thai events are announced in
  Thai on channels this tool cannot reach. A nationwide selector would be empty
  in most provinces and is deliberately excluded. (`SPEC.md` §9.1)
- **Expected volume is 10–15 usable events per city per week.** This is a list a
  person reads on a Monday, not a data feed. The interface and the expectations
  set with stakeholders are sized accordingly. (`SPEC.md` §9.2)
- **"Partner" is read broadly for v1**: any venue or organizer worth a BD
  conversation. The source brief uses the word for three different things — a
  merchant who accepts payment, a top-up point where cash enters the wallet, and
  a referrer who sends users — and has not been clarified. This is recorded as
  an open question for the business owner. It affects how leads would be ranked,
  and ranking is out of scope for v1, so it does not block delivery.
  (`SPEC.md` §10.1)
- **Vendor and sponsor lists are not available.** The original brief asks for
  them; this data is not published for the events in scope. Venue and organizer
  are the two real outputs. (`SPEC.md` §9.3)
- **A venue's district cannot be derived from published event data**, because
  sources mix district, subdistrict, city and country in the same field. It
  requires an external lookup, which is why district is an output column and
  never a search input. (`SPEC.md` §9.4)
- **Results are fetched fresh on each run.** Volume is low and a run takes
  seconds, so no stored result set is kept in v1. Only identified venues are
  remembered, to avoid paying twice for the same lookup.
- **No login at the delivery point.** Protection arrives with the Places key as a shared password, because that is when a Run starts costing money (`SPEC.md` §9.10).
- **English-only interface.** The team works in English; Thai text from sources
  is preserved but the interface is not translated.
- **One shared view.** No per-user roles, permissions or saved state — everyone
  on the team sees the same thing.
- **No record of outreach is kept.** The tool finds who to approach; tracking
  who was contacted and what happened is explicitly out of scope, and the
  spreadsheet is where that work continues today.

## Dependencies

- A public event source that publishes structured listings for the supported
  cities, reachable from wherever the tool runs. Verifying this reachability is
  the first milestone, because the design depends on it. (`SPEC.md` §9.5)
- A place-information service for venue district, phone and website. Required
  only for User Story 3; Stories 1, 2 and 4 ship without it.
- Provisioning and billing ownership for that service is an open question for
  the business owner. (`SPEC.md` §10.2)

## Out of Scope

Map view · outreach tracking or CRM pipeline · per-user login · Thai-language
interface · vendor and sponsor lists · automatic lead scoring or ranking ·
scheduled alerts · nationwide province coverage · document uploads · importing
existing records · filtering the search by district.
