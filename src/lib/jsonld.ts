/**
 * Serialise for an inline <script type="application/ld+json">.
 *
 * JSON.stringify leaves "/" alone, so a scraped event name containing
 * "</script>" would close the tag and run the rest of the name as HTML.
 * Escaping the angle brackets is valid JSON and parses back to the original
 * text, so the markup is safe and the data is unchanged.
 */
export function ldScript(value: unknown): string {
  return JSON.stringify(value).replace(/[<>]/g, (c) =>
    c === "<" ? "\\u003c" : "\\u003e",
  );
}
