export type CityId = "chiang-mai" | "bangkok" | "phuket";

export type Event = {
  source: "meetup";
  name: string;
  url: string;
  /** ISO 8601 UTC, exactly as published. Never exported — see startLocal. */
  startUtc: string;
  /** Asia/Bangkok, "YYYY-MM-DD HH:MM". The only time a human ever sees. */
  startLocal: string;
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

export type SourceError = { source: "meetup"; message: string };

export type RunResult = {
  city: CityId;
  from: string;
  to: string;
  fetchedAt: string;
  events: Event[];
  dropped: DroppedCounts;
  errors: SourceError[];
};
