/*
 * Screenshot + layout audit helper. Not part of the app.
 *
 * Drives the Chrome already installed on the machine (playwright-core, no
 * browser download). Beyond the picture it reports any element wider than the
 * viewport, because horizontal overflow on a phone is the single easiest way to
 * make a mobile-first site feel broken and the hardest to spot in a screenshot.
 *
 *   node scripts/shoot.mjs <path> [--desktop] [--full]
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = process.env.SHOOT_DIR ?? "./.shots";

const args = process.argv.slice(2);
const path = args.find((a) => !a.startsWith("--")) ?? "/";
const desktop = args.includes("--desktop");
const full = args.includes("--full");

const viewport = desktop
  ? { width: 1440, height: 900 }
  : { width: 390, height: 844 };

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({
  viewport,
  deviceScaleFactor: 2,
  isMobile: !desktop,
  hasTouch: !desktop,
});

const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});

const url = `http://localhost:3000${path}`;
const response = await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(400);

const audit = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth;

  // A snap rail is SUPPOSED to have children past the right edge — that is what
  // makes it scroll. Only report elements that escape the document, not ones
  // sitting inside something built to scroll horizontally.
  const inScroller = (el) => {
    for (let n = el.parentElement; n; n = n.parentElement) {
      const ox = getComputedStyle(n).overflowX;
      if (ox === "auto" || ox === "scroll") return true;
    }
    return false;
  };

  const wide = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (inScroller(el)) continue;
    if (r.right > vw + 1 || r.left < -1) {
      // Report the shallowest offender: a wide parent explains its children.
      if (wide.some((w) => w.el.contains(el))) continue;
      wide.push({
        el,
        tag: el.tagName.toLowerCase(),
        cls: (el.className || "").toString().slice(0, 90),
        left: Math.round(r.left),
        right: Math.round(r.right),
      });
    }
  }
  return {
    vw,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    overflow: wide.map(({ tag, cls, left, right }) => ({ tag, cls, left, right })),
  };
});

const slug = `${path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home"}-${desktop ? "desktop" : "mobile"}`;

if (args.includes("--slices")) {
  // A tall page is unreadable as one image. Save it as viewport-sized frames
  // with a little overlap, which is how it is actually seen.
  const step = Math.round(viewport.height * 0.92);
  const frames = Math.ceil(audit.scrollHeight / step);
  for (let i = 0; i < frames; i++) {
    await page.screenshot({
      path: `${OUT}/${slug}-${String(i).padStart(2, "0")}.png`,
      clip: {
        x: 0,
        y: i * step,
        width: viewport.width,
        height: Math.min(viewport.height, audit.scrollHeight - i * step),
      },
      fullPage: true,
    });
  }
  console.log(`wrote ${frames} frames to ${OUT}/${slug}-NN.png`);
} else {
  await page.screenshot({ path: `${OUT}/${slug}${full ? "-full" : ""}.png`, fullPage: full });
}

console.log(`status      ${response?.status()}`);
console.log(`viewport    ${viewport.width}x${viewport.height}`);
console.log(`document    ${audit.scrollWidth}x${audit.scrollHeight}`);
console.log(
  audit.scrollWidth > audit.vw + 1
    ? `HORIZONTAL OVERFLOW: document is ${audit.scrollWidth - audit.vw}px wider than the viewport`
    : "no horizontal overflow",
);
if (audit.overflow.length) {
  console.log("\noffenders (shallowest first):");
  for (const o of audit.overflow) {
    console.log(`  <${o.tag}> [${o.left} → ${o.right}]  ${o.cls}`);
  }
}
if (errors.length) console.log(`\npage errors:\n  ${errors.join("\n  ")}`);

await browser.close();
