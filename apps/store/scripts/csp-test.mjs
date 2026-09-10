/*
 * Proves the Content-Security-Policy actually stops an XSS, and that the
 * site still works under it.
 *
 *   npx next build apps/store && npx next start apps/store -p 3100
 *   node apps/store/scripts/csp-test.mjs
 *
 * Run against a PRODUCTION build: development relaxes the policy with
 * 'unsafe-eval' so React can rebuild server stack traces, which would make
 * this test lie.
 *
 * Two things it asserts, and both matter:
 *
 *   1. the strict policy BLOCKS an inline event handler injected as markup —
 *      the shape a stored XSS actually takes here, where attacker text
 *      reaches the HTML and the browser parses their tag;
 *   2. every page still renders and stays interactive under it, because a
 *      CSP that breaks the site protects nothing — it gets removed within
 *      the hour. (That is not hypothetical: a `default-src 'self'` shipped
 *      here once and silently killed hydration on every page.)
 *
 * NOT treated as a bypass: document.createElement('script') from code that
 * is already running. 'strict-dynamic' permits that by design, and an
 * attacker who can already execute JavaScript has by definition already won.
 */
import { chromium } from "playwright-core";

const B = process.env.BASE_URL ?? "http://localhost:3100";
const b = await chromium.launch({ channel: "chrome" });
let fail = 0;
const ck = (n, ok, x = "") => { if (!ok) fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${x ? "  " + x : ""}`); };

/* Dynamic pages carry the nonce policy; static ones cannot (Next can only
   inject a nonce during a request) and render no user input. */
const STRICT = ["/shop", "/checkout", "/cart", "/wishlist", "/track", "/shop/silver-moon-waist-chain"];
const STATIC = ["/"];

async function open(path) {
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const csp = [], errs = [];
  p.on("console", (m) => {
    const t = m.text();
    if (/Content Security Policy|Refused to/i.test(t)) csp.push(t.slice(0, 90));
    else if (m.type() === "error") errs.push(t.slice(0, 90));
  });
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 90)));
  await p.goto(B + path, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2000);
  return { p, csp, errs };
}

/* Inject an inline event handler as MARKUP — the stored-XSS shape. */
const injectHandler = (p) =>
  p.evaluate(() => new Promise((resolve) => {
    window.__pwned = false;
    const host = document.createElement("div");
    host.innerHTML = '<img src="x" onerror="window.__pwned = true">';
    document.body.appendChild(host);
    setTimeout(() => resolve(window.__pwned), 400);
  }));

console.log("── the site still works under the policy ──");
for (const path of [...STRICT, ...STATIC]) {
  const { p, csp, errs } = await open(path);
  ck(`${path.padEnd(32)} renders clean`, csp.length === 0 && errs.length === 0,
     csp.length || errs.length ? `csp=${csp.length} err=${errs.length} ${csp[0] || errs[0] || ""}` : "");
  await p.context().close();
}

console.log("\n── and it blocks an injected inline handler ──");
for (const path of STRICT) {
  const { p } = await open(path);
  ck(`${path.padEnd(32)} XSS blocked`, (await injectHandler(p)) === false);
  await p.context().close();
}

console.log("\n── static pages: no script-src, and that is known ──");
for (const path of STATIC) {
  const { p } = await open(path);
  ck(`${path.padEnd(32)} unprotected (expected, no user input)`, (await injectHandler(p)) === true);
  await p.context().close();
}

console.log("\n── the JSON-LD survives the strict policy ──");
{
  const { p, csp } = await open("/shop/silver-moon-waist-chain");
  const ld = await p.evaluate(() => {
    const el = document.querySelector('script[type="application/ld+json"]');
    if (!el) return null;
    try { return { nonce: el.hasAttribute("nonce"), ok: !!JSON.parse(el.textContent) }; }
    catch { return { nonce: el.hasAttribute("nonce"), ok: false }; }
  });
  ck("product JSON-LD is present, nonced and valid", !!ld && ld.nonce && ld.ok, JSON.stringify(ld));
  ck("...and triggers no violation", csp.length === 0);
  await p.context().close();
}

console.log("\n── nonces are per-request ──");
{
  const one = await fetch(B + "/checkout").then((r) => r.headers.get("content-security-policy"));
  const two = await fetch(B + "/checkout").then((r) => r.headers.get("content-security-policy"));
  const n = (h) => (h ?? "").match(/nonce-([a-f0-9]+)/)?.[1];
  ck("a fresh nonce on every request", !!n(one) && !!n(two) && n(one) !== n(two));
}

await b.close();
console.log(fail ? `\n${fail} FAILURE(S)` : "\nall pass");
process.exit(fail ? 1 : 0);
