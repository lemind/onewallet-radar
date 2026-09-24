export type CityId = "chiang-mai" | "bangkok" | "phuket";

export type Source = "meetup" | "eventbrite";

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
};

export type DroppedCounts = {
  online: number;
  noVenue: number;
  noDate: number;
  outOfRange: number;
  duplicate: number;
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
};
