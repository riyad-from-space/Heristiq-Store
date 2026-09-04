/*
 * Walks a real order through the site, on a phone viewport. Not part of the app.
 *
 *   npm run dev
 *   node scripts/checkout-e2e.mjs
 *
 * PDP add-to-cart → grid quick-add → cart → OTP → address cascade → place
 * order → confirmation → cart cleared. It reads the development OTP off the
 * page, so it needs no SMS gateway, and it runs against the mock catalogue, so
 * it needs no credentials.
 *
 * Checked at every stop: no console or page errors, and nothing wider than the
 * viewport. Checkout is the screen where a horizontal scrollbar costs money,
 * and it is the screen hardest to eyeball because it is mostly form controls.
 *
 * Drives the Chrome already on the machine via playwright-core — no download.
 * Screenshots land in SHOOT_DIR (default ./.shots), same as shoot.mjs.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = process.env.SHOOT_DIR ?? "./.shots";
const BASE = "http://localhost:3000";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});

const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });

const step = (msg) => console.log(`→ ${msg}`);
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });

async function overflow(label) {
  const bad = await page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    return [...document.querySelectorAll("*")]
      .filter((el) => el.getBoundingClientRect().width > w + 1)
      .slice(0, 3)
      .map((el) => el.tagName + "." + (el.className?.toString?.().slice(0, 40) ?? ""));
  });
  console.log(`   overflow[${label}]: ${bad.length ? bad.join(" | ") : "none"}`);
}

step("PDP → add to cart");
await page.goto(`${BASE}/shop/silver-moon-waist-chain`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /add to cart/i }).click();
await page.getByRole("link", { name: /added — view cart/i }).waitFor({ timeout: 5000 });
console.log("   added ✓");

step("grid quick-add");
await page.goto(`${BASE}/shop`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /^Add Golden starfish waist chain to cart$/ }).click();
await page.waitForTimeout(300);
const badge = await page.locator("header a[aria-label^='Cart']").innerText();
console.log(`   header cart badge: ${JSON.stringify(badge.trim())}`);
await overflow("shop");

step("cart page");
await page.goto(`${BASE}/cart`, { waitUntil: "networkidle" });
await shot("cart-mobile");
await overflow("cart");
console.log(`   lines: ${await page.locator("main ul > li").count()}`);

step("checkout: contact + OTP");
await page.goto(`${BASE}/checkout`, { waitUntil: "networkidle" });
await page.fill("#name", "Nusrat Jahan");
await page.fill("#phone", "01712345678");
await page.getByRole("button", { name: /send code/i }).click();
await page.locator("#otp").waitFor({ timeout: 8000 });
const devText = await page.locator("text=Dev mode").innerText();
const code = devText.match(/(\d{6})/)?.[1];
console.log(`   dev code: ${code}`);
if (!code) throw new Error("no dev code shown");
await page.fill("#otp", code);
await page.getByRole("button", { name: /^Verify$/ }).click();
await page.locator("text=verified").waitFor({ timeout: 8000 });
console.log("   phone verified ✓");

step("checkout: address cascade");
await page.selectOption("#division", "dhaka");
const districtCount = await page.locator("#district option").count();
console.log(`   districts for Dhaka division: ${districtCount - 1}`);
await page.selectOption("#district", "dhaka");
const areaCount = await page.locator("#area-options option").count();
console.log(`   area suggestions for Dhaka: ${areaCount}`);
await page.fill("#area", "Mirpur");
await page.fill("#addressLine", "House 12 (3rd floor), Road 5, Block C");
await page.fill("#landmark", "Beside Mirpur DOHS gate 1");
await page.fill("#note", "Please call before 6pm");
await page.waitForTimeout(200);
const feeInside = await page.locator("main").innerText();
console.log(`   inside-Dhaka summary shows: ${/inside Dhaka/.test(feeInside) ? "yes" : "NO"}`);
await shot("checkout-mobile");
await overflow("checkout");

step("switch to an outside-Dhaka district and watch the fee");
await page.selectOption("#division", "sylhet");
await page.selectOption("#district", "sylhet");
await page.waitForTimeout(200);
console.log(`   outside label: ${/outside Dhaka/.test(await page.locator("main").innerText()) ? "yes" : "NO"}`);
await page.selectOption("#division", "dhaka");
await page.selectOption("#district", "dhaka");
await page.fill("#area", "Mirpur");
await page.fill("#addressLine", "House 12 (3rd floor), Road 5, Block C");

step("place order");
await page.getByRole("button", { name: /place order/i }).click();
await page.waitForURL(/\/order\//, { timeout: 15000 });
console.log(`   landed on: ${new URL(page.url()).pathname}`);
await page.waitForLoadState("networkidle");
await shot("order-confirmation-mobile");
await overflow("confirmation");
const body = await page.locator("main").innerText();
console.log(`   reference: ${body.match(/HQ-\d+/)?.[0]}`);
console.log(`   demo banner: ${/Demo mode/.test(body) ? "shown" : "MISSING"}`);
console.log(`   pay on delivery line: ${body.match(/Pay on delivery\s*\n?\s*৳?[\d,]+/)?.[0]?.replace(/\n/g, " ")}`);

step("cart cleared after order");
await page.goto(`${BASE}/cart`, { waitUntil: "networkidle" });
console.log(`   cart now: ${/Your cart is empty/.test(await page.locator("main").innerText()) ? "empty ✓" : "STILL HAS LINES"}`);

console.log(errors.length ? `\n!! page errors:\n${errors.join("\n")}` : "\nno page errors");
await browser.close();
