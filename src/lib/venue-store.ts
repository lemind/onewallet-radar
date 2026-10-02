/**
 * Venues found at runtime, kept in Redis so a geocode is bought once and never
 * again. The file in src/data is the base; this is everything learned since.
 *
 * Every rule here exists because Places billed $40 on 2 Oct by asking the same
 * questions on every rebuild:
 *  - a miss is stored as a miss, so an unfindable venue is never re-asked
 *  - a monthly counter lives in the store and caps what a month can spend
 *  - no store reachable means no geocoding at all, never a silent fallback
 */
// The marketplace integration names these UPSTASH_*; the KV_* pair is what
// Vercel's own KV used to set, kept so a different store drops in unchanged.
const URL_ = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

/**
 * Most a month may buy. Google gives 10,000 geocodes a month free; this stops
 * well short so a loop or a bad key cannot reach the paid band at all.
 */
export const MONTHLY_CAP = 2_000;

export type Fixed = { lat: number; lng: number };

/** Configured at all? Without both halves nothing here touches the network. */
export function storeReady(): boolean {
  return Boolean(URL_ && TOKEN);
}

/** One Upstash REST command. Returns null on any failure: this must never fail a run. */
async function cmd(args: (string | number)[], signal?: AbortSignal): Promise<unknown> {
  if (!storeReady()) return null;
  try {
    const res = await fetch(URL_!, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      signal,
      cache: "no-store",
    });
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      return null;
    }
    return (await res.json())?.result ?? null;
  } catch {
    return null;
  }
}

/** The counter key is the month itself, so a new month starts at zero with no reset job. */
function monthKey(now = new Date()): string {
  return `geo:spend:${now.toISOString().slice(0, 7)}`;
}

/** "hit" with a point, "miss" for looked-up-and-not-found, "unknown" for never asked. */
export type Known = { state: "hit"; at: Fixed } | { state: "miss" } | { state: "unknown" };

export async function recall(key: string, signal?: AbortSignal): Promise<Known> {
  const raw = await cmd(["GET", `venue:${key}`], signal);
  if (typeof raw !== "string") return { state: "unknown" };
  if (raw === "null") return { state: "miss" };
  try {
    const at = JSON.parse(raw) as Fixed;
    return typeof at?.lat === "number" && typeof at?.lng === "number"
      ? { state: "hit", at }
      : { state: "unknown" };
  } catch {
    return { state: "unknown" };
  }
}

export async function remember(key: string, at: Fixed | null, signal?: AbortSignal): Promise<void> {
  await cmd(["SET", `venue:${key}`, at ? JSON.stringify(at) : "null"], signal);
}

/**
 * Claim one paid lookup for this month, or refuse. Incremented before the call,
 * not after: a crash mid-request must cost the budget, not go unnoticed.
 * Refuses when the store is unreachable, because then nothing is counting.
 */
export async function claimLookup(signal?: AbortSignal): Promise<boolean> {
  const key = monthKey();
  const used = await cmd(["INCR", key], signal);
  if (typeof used !== "number") return false; // no store, no counting, no spending
  // Expire after 70 days so old months do not accumulate; set once is enough,
  // but setting it again is harmless and survives a key that lost its TTL.
  if (used === 1) await cmd(["EXPIRE", key, 70 * 86_400], signal);
  return used <= MONTHLY_CAP;
}

/** What this month has spent so far, for the page that reports it. */
export async function spentThisMonth(signal?: AbortSignal): Promise<number | null> {
  const used = await cmd(["GET", monthKey()], signal);
  if (used == null) return null;
  const n = Number(used);
  return Number.isFinite(n) ? n : null;
}
