/*
 * The category system, end to end in a real browser.
 *
 *   npx next start -p 3100   (or npm run dev, then BASE_URL=http://localhost:3000)
 *   node apps/store/scripts/category-test.mjs
 *
 * What this exists to catch, in order of how quietly each one fails:
 *
 *   1. THE ROUTING COLLISION. /shop/[slug] serves both categories and
 *      products, resolving category first. If a product slug ever equals a
 *      category slug the product page becomes unreachable — and nothing
 *      errors, the category page simply renders instead. Migration 1008
 *      guards the reserved route names in the database; this guards the
 *      actual behaviour, which is the half a constraint cannot see.
 *
 *   2. A CATEGORY WITH NO PRODUCTS still rendering as a designed page. Four
 *      of the five are empty until the pieces are photographed, so this is
 *      not an edge case — for now it is most of the shop.
 *
 *   3. THE MENU MATCHING THE DATABASE. The header, the chips and the home
 *      tiles all read the same taxonomy; a category the owner adds in the
 *      ERP has to appear in all three with no deploy. If the counts drift,
 *      one of them is reading something stale.
 *
 * Runs against whatever catalogue the server has — real or mock — because
 * both must work. It asserts relationships (every category in the API is in
 * the menu) rather than hardcoded names, so adding a sixth category does not
 * break the test.
 */
import { chromium } from "playwright-core";

const B = process.env.BASE_URL ?? "http://localhost:3100";
const browser = await chromium.launch({ channel: "chrome" });
let fail = 0;
const ck = (name, ok, detail = "") => {
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

async function open(path, width = 1280) {
  const page = await (
    await browser.newContext({ viewport: { width, height: 900 } })
  ).newPage();
  const problems = [];
  page.on("pageerror", (e) => problems.push(String(e).slice(0, 70)));
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) {
      problems.push("CSP: " + m.text().slice(0, 60));
    }
  });
  const res = await page.goto(B + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  return { page, problems, status: res?.status() ?? 0 };
}

/* ── 1. what the taxonomy actually is, from the page the shop renders ───── */

const { page: shop, problems: shopProblems } = await open("/shop");
const chips = await shop.evaluate(() =>
  [...document.querySelectorAll('a[href^="/shop/"]')]
    .map((a) => a.getAttribute("href"))
    .filter((h) => h && !h.includes("?"))
    .map((h) => h.replace("/shop/", "")),
);
/*
 * CANDIDATES, not categories. Category chips and product cards both link to
 * /shop/<something>, so this list mixes the two — scraping it and calling the
 * result "the categories" is what made the first version of this test report
 * seven product slugs as missing from the header menu.
 *
 * Each one is visited below and classified by what the page actually is.
 */
const candidateSlugs = [...new Set(chips)];
ck("/shop renders clean", shopProblems.length === 0, shopProblems[0] ?? "");
ck(
  "/shop offers links into the catalogue",
  candidateSlugs.length > 0,
  `${candidateSlugs.length} distinct /shop/* links`,
);
await shop.context().close();

console.log("\n── every category page renders ──");

const seen = [];
for (const slug of candidateSlugs) {
  const { page, problems, status } = await open(`/shop/${slug}`);
  const info = await page.evaluate(() => {
    const body = document.body.innerText;
    return {
      heading: document.querySelector("h1")?.textContent?.trim() ?? "",
      /*
       * A CATEGORY page renders the chip row with its own chip marked
       * current. A product page has no chip row at all, so this separates
       * the two without guessing from the slug or the heading.
       */
      isCategory: !!document.querySelector(
        `a[aria-current="true"][href="${location.pathname}"]`,
      ),
      hasGrid: document.querySelectorAll("h3 a[href^='/shop/']").length > 0,
      isEmptyState: /being photographed/i.test(body),
      /* Matched on "404" and the noindex meta, not on prose: this project
         has its own on-brand copy ("This page has wandered off"), and an
         earlier version of this test looked for Next's DEFAULT wording and
         silently never matched. */
      is404:
        /\b404\b/.test(body) ||
        !!document.querySelector('meta[name="robots"][content*="noindex"]'),
    };
  });

  /* Products and 404s are not this section's business. */
  if (info.is404 || !info.isCategory) {
    await page.context().close();
    continue;
  }

  seen.push({ slug, ...info });
  ck(
    `/shop/${slug}`.padEnd(34) + ` "${info.heading}"`,
    status === 200 &&
      problems.length === 0 &&
      info.heading.length > 0 &&
      (info.hasGrid || info.isEmptyState),
    problems[0] ??
      (info.hasGrid ? "grid" : info.isEmptyState ? "empty state" : "NEITHER grid nor empty state"),
  );
  await page.context().close();
}

console.log("\n── an empty category is a designed page, not a blank one ──");

const empties = seen.filter((s) => s.isEmptyState);
if (empties.length === 0) {
  console.log("note  every category has stock — nothing to check here");
} else {
  const { page, problems } = await open(`/shop/${empties[0].slug}`);
  const state = await page.evaluate(() => ({
    heading: /being photographed/i.test(document.body.innerText),
    /* The way out, and the way to ask. An empty page with no exit is a
       dead end; this business sells over WhatsApp. */
    shopLink: !!document.querySelector('a[href="/shop"]'),
    whatsapp: !!document.querySelector('a[href*="wa.me"]'),
    /* No "0 pieces" anywhere — a count of zero is an apology. */
    saysZero: /\b0 pieces\b/.test(document.body.innerText),
  }));
  ck(`${empties[0].slug}: says it is coming`, state.heading);
  ck(`${empties[0].slug}: offers a way back to stock`, state.shopLink);
  ck(`${empties[0].slug}: offers WhatsApp`, state.whatsapp);
  ck(`${empties[0].slug}: renders clean`, problems.length === 0, problems[0] ?? "");
  await page.context().close();
}

console.log("\n── the header menu matches the taxonomy ──");

{
  const { page } = await open("/shop");
  await page.getByRole("button", { name: /^Shop$/ }).click();
  await page.waitForTimeout(500);
  const menu = await page.evaluate(() =>
    [...document.querySelectorAll('nav a[href^="/shop/"]')].map((a) =>
      a.getAttribute("href").replace("/shop/", ""),
    ),
  );
  const missing = seen.filter((s) => !menu.includes(s.slug)).map((s) => s.slug);
  ck(
    "every category is in the header menu",
    missing.length === 0,
    missing.length ? `missing: ${missing.join(", ")}` : `${menu.length} links`,
  );
  await page.context().close();
}

console.log("\n── the phone menu lists them too ──");

{
  const { page } = await open("/shop", 390);
  await page.getByRole("button", { name: /open menu/i }).click();
  await page.waitForTimeout(600);
  const menu = await page.evaluate(() =>
    [...document.querySelectorAll('a[href^="/shop/"]')].map((a) =>
      a.getAttribute("href").replace("/shop/", ""),
    ),
  );
  const missing = seen.filter((s) => !menu.includes(s.slug)).map((s) => s.slug);
  ck(
    "every category is in the phone menu",
    missing.length === 0,
    missing.length ? `missing: ${missing.join(", ")}` : `${seen.length} categories`,
  );
  await page.context().close();
}

console.log("\n── the home row links to every category ──");

{
  const { page, problems } = await open("/");
  const tiles = await page.evaluate(() =>
    [...document.querySelectorAll('a[href^="/shop/"]')]
      .map((a) => a.getAttribute("href").replace("/shop/", "")),
  );
  const missing = seen.filter((s) => !tiles.includes(s.slug)).map((s) => s.slug);
  ck("home page renders clean", problems.length === 0, problems[0] ?? "");
  ck(
    "home links to every category",
    missing.length === 0,
    missing.length ? `missing: ${missing.join(", ")}` : `${seen.length} tiles`,
  );
  await page.context().close();
}

console.log("\n── a product page still wins its own URL ──");

{
  /* The collision guard. Find a real product link from the shop grid and
     confirm it renders the PRODUCT, not a category page. */
  const { page } = await open("/shop");
  const productHref = await page.evaluate(() => {
    const known = [...document.querySelectorAll('a[href^="/shop/"] , a[href^="/shop/"]')];
    const withHeading = known.find((a) => a.closest("h3") || a.querySelector("h3"));
    return withHeading?.getAttribute("href") ?? null;
  });
  await page.context().close();

  if (!productHref) {
    console.log("note  no products in the catalogue — cannot check the collision");
  } else {
    const { page: pdp, problems, status } = await open(productHref);
    const isProduct = await pdp.evaluate(
      () =>
        !!document.querySelector('script[type="application/ld+json"]') &&
        !/being photographed/i.test(document.body.innerText),
    );
    ck(
      `${productHref} is the PRODUCT page`,
      status === 200 && isProduct && problems.length === 0,
      problems[0] ?? "",
    );
    /* And its breadcrumb points at its own category rather than a hardcoded
       one — the bug that would send a bracelet back to waist chains. */
    const crumb = await pdp.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Breadcrumb"]');
      return nav ? [...nav.querySelectorAll("a")].map((a) => a.getAttribute("href")) : [];
    });
    ck(
      "its breadcrumb points at a category",
      crumb.some((h) => h === "/shop" || /^\/shop\/[a-z-]+$/.test(h ?? "")),
      crumb.join(" > "),
    );
    await pdp.context().close();
  }
}

console.log("\n── an unknown slug is still not found ──");

{
  const { page } = await open("/shop/definitely-not-a-category-or-product");
  const result = await page.evaluate(() => ({
    saysNotFound: /\b404\b/.test(document.body.innerText),
    /*
     * The STATUS is deliberately not asserted.
     *
     * Next returns 200 for a streamed response and 404 only for a
     * non-streamed one — its own not-found docs say so — and these pages
     * stream. Asserting 404 here would fail forever against correct
     * behaviour, which is exactly what the first version of this test did.
     *
     * What actually matters for SEO is that the page is not indexable, and
     * Next injects the noindex meta on notFound() regardless of the status
     * code. That is the thing worth guarding: if it ever disappeared,
     * Google would start indexing "not found" pages under real product URLs.
     */
    noindex: !!document.querySelector('meta[name="robots"][content*="noindex"]'),
  }));
  ck("unknown slug renders the not-found page", result.saysNotFound);
  ck("...and is marked noindex", result.noindex);
  await page.context().close();
}

/* And the opposite: a real product must NOT be noindex. A guard that only
   checks the 404 case would not notice the meta leaking onto every page. */
{
  const { page } = await open("/shop/silver-moon-waist-chain");
  const noindex = await page.evaluate(
    () => !!document.querySelector('meta[name="robots"][content*="noindex"]'),
  );
  ck("a real product page is indexable", !noindex);
  await page.context().close();
}

await browser.close();
console.log(
  fail ? `\n${fail} FAILURE(S)\n` : `\nall pass — ${seen.length} categories\n`,
);
process.exit(fail ? 1 : 0);
