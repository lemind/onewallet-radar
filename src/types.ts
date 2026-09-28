export type CityId = "chiang-mai" | "bangkok" | "phuket";

export type Source = "meetup" | "eventbrite" | "luma" | "allevents" | "bandsintown" | "ra";

export type Event = {
  source: Source;
  name: string;
  url: string;
  /** ISO 8601 UTC, exactly as published. Never exported — see startLocal. */
  startUtc: string;
  /** Asia/Bangkok. "YYYY-MM-DD HH:MM", or just "YYYY-MM-DD" when the source published no time. */
  startLocal: string;
  /** "date" when the source published a bare date — never invent a midnight. */
  startPrecision: "date" | "datetime";
  end: string | null;
  venue: string | null;
  address: string | null;
  organizer: string | null;
  organizerUrl: string | null;
  /** Who is playing, where the source says so. Bandsintown and RA publish it. */
  performer: string | null;
  /** From Google Places, for venues the source left unplaced. See SPEC.md 9.4. */
  phone: string | null;
  website: string | null;
  /** True when the coordinates came from Places rather than the source. */
  located: boolean;
  /** True when the source says it is online-only: an organizer lead, no venue. */
  online: boolean;
  /** Venue coordinates where the source publishes them; Meetup never does. */
  lat: number | null;
  lng: number | null;
};

export type DroppedCounts = {
  online: number;
  noVenue: number;
  noDate: number;
  outOfRange: number;
  duplicate: number;
  farAway: number;
};

export type SourceError = { source: Source; message: string };

export type RunResult = {
  city: CityId;
  from: string;
  to: string;
  fetchedAt: string;
  events: Event[];
  dropped: DroppedCounts;
  errors: SourceError[];
  /** Things worth saying that are not failures, such as a source hitting its page cap. */
  notices: SourceError[];
};
