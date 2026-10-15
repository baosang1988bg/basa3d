// Phase 35 D2: JSON-LD goes into a raw <script> via dangerouslySetInnerHTML, and JSON.stringify does
// not escape `</script>` — a product name or blog title containing it would break out of the tag
// (stored XSS on the storefront origin, which is also the /admin origin). Escape every character
// that can end or confuse an HTML script block. The output is still valid JSON for crawlers.
const UNSAFE_CHARS: Record<string, string> = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
};

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (char) => UNSAFE_CHARS[char]);
}
