/*
 * Walks phase 4 end to end, on a phone viewport. Not part of the app.
 *
 *   ADMIN_TOKEN=test-admin-token PATHAO_WEBHOOK_SECRET=test-pathao-secret npm run dev
 *   node scripts/courier-e2e.mjs
 *
 * Place an order → push it to a courier → refuse a second push → reject an
 * unauthenticated push → deliver a webhook → reject a bad webhook token →
 * ignore a replay → ignore a stale status → see the normalised rail on /track
 * and on the confirmation page. Also checks that /track refuses the right
 * order with the wrong phone.
 *
 * Needs no courier credentials: with none set, and outside production, the
 * demo provider stands in (src/lib/courier/demo.ts).
 */
import { chromium } from "playwright-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = process.env.SHOOT_DIR;
const BASE = "http://localhost:3000";
const ADMIN = "test-admin-token";
const HOOK = "test-pathao-secret";
/* A fresh number each run: the OTP resend cooldown is per phone, and it
   deliberately outlives one test. Ends in 0 so the demo risk check flags it. */
const PHONE = `017${String(Math.floor(Math.random() * 10000000)).padStart(7, "0")}0`.slice(0, 11);
console.log(`   using phone ${PHONE}`);

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const errs = [];
page.on("pageerror", e => errs.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text()); });
const shot = n => page.screenshot({ path: `${OUT}/${n}.png`, fullPage: true });

// ---- place an order (phone ends in 0 so the demo risk check flags it)
console.log("— placing an order");
await page.goto(`${BASE}/shop/silver-moon-waist-chain`);
await page.getByRole("button", { name: /add to cart/i }).click();
await page.goto(`${BASE}/checkout`, { waitUntil: "networkidle" });
await page.fill("#name", "Nusrat Jahan");
await page.fill("#phone", PHONE);
await page.getByRole("button", { name: /send code/i }).click();
await page.locator("#otp").waitFor();
const code = (await page.locator("text=Dev mode").innerText()).match(/(\d{6})/)[1];
await page.fill("#otp", code);
await page.getByRole("button", { name: /^Verify$/ }).click();
await page.locator("text=verified").waitFor();
await page.selectOption("#division", "dhaka");
await page.selectOption("#district", "dhaka");
await page.fill("#area", "Mirpur");
await page.fill("#addressLine", "House 12 (3rd floor), Road 5, Block C");
await page.getByRole("button", { name: /place order/i }).click();
await page.waitForURL(/\/order\//);
const orderUrl = page.url();
const body = await page.locator("main").innerText();
const reference = body.match(/HQ-\d+/)[0];
console.log(`   ${reference} placed, token url ${new URL(orderUrl).pathname}`);

// ---- confirmation page shows no tracking yet
console.log("— before shipping, the confirmation page says 'being packed', not 'with courier'");
console.log(`   shows "What happens now": ${/What happens now/.test(body)}`);
console.log(`   shows a status rail:      ${/Pickup scheduled|Picked up/.test(body)}`);

// ---- track before shipping
console.log("— /track before shipping");
await page.goto(`${BASE}/track?ref=${reference}`, { waitUntil: "networkidle" });
await page.fill("#track-phone", PHONE);
await page.getByRole("button", { name: /^Track$/ }).click();
await page.locator("text=Being packed").waitFor({ timeout: 10000 });
console.log("   'Being packed' ✓");

// ---- wrong phone must not disclose
console.log("— /track with the wrong phone");
await page.goto(`${BASE}/track`, { waitUntil: "networkidle" });
await page.fill("#reference", reference);
await page.fill("#track-phone", "01999999999");
await page.getByRole("button", { name: /^Track$/ }).click();
await page.waitForTimeout(1200);
const denied = await page.locator("main [role=alert]").first().innerText();
console.log(`   refused: ${/could not find that order/.test(denied)}`);

// ---- one-tap push
console.log("— pushing to the courier");
const shipRes = await fetch(`${BASE}/api/admin/orders/${reference}/ship`, {
  method: "POST", headers: { Authorization: `Bearer ${ADMIN}`, "Content-Type": "application/json" }, body: "{}",
});
const ship = await shipRes.json();
console.log(`   HTTP ${shipRes.status} courier=${ship.courier} tracking=${ship.trackingCode} status=${ship.status} cod=${ship.codAmount}`);
console.log(`   risk flagged: ${ship.riskNote ? "yes — " + ship.riskNote.slice(0, 60) : "no"}`);
console.log(`   demo: ${ship.demo}`);

// ---- double push must be refused
console.log("— pushing the same order twice");
const dup = await fetch(`${BASE}/api/admin/orders/${reference}/ship`, {
  method: "POST", headers: { Authorization: `Bearer ${ADMIN}`, "Content-Type": "application/json" }, body: "{}",
});
const dupBody = await dup.json();
console.log(`   HTTP ${dup.status} (want 409): ${dupBody.error?.slice(0, 70)}`);

// ---- unauthorised push
const noAuth = await fetch(`${BASE}/api/admin/orders/${reference}/ship`, { method: "POST" });
console.log(`— unauthenticated push: HTTP ${noAuth.status} (want 401)`);

// ---- webhook
console.log("— webhook");
/* Pathao's contract: X-PATHAO-Signature in, 202 out with their integration
   header. See src/app/api/webhooks/pathao/route.ts. */
const hook = async (status, updated, token = HOOK) => {
  const r = await fetch(`${BASE}/api/webhooks/pathao`, {
    method: "POST",
    headers: { "X-PATHAO-Signature": token, "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "order.updated",
      order_status: status,
      consignment_id: ship.consignmentId,
      merchant_order_id: reference,
      delivery_fee: 60,
      updated_at: updated,
    }),
  });
  const header = r.headers.get("x-pathao-merchant-webhook-integration-secret");
  return `${r.status}${header ? " +hdr" : " NO-HDR"}`;
};
console.log(`   bad signature:      HTTP ${await hook("In_Transit", "t1", "wrong")} (want 401)`);
console.log(`   Assigned_for_Delivery: HTTP ${await hook("Assigned_for_Delivery", "t2")} (want 202)`);
console.log(`   replay of the same:    HTTP ${await hook("Assigned_for_Delivery", "t2")} (want 202)`);
// Pathao's integration handshake, which must be accepted before any order event
{
  const r = await fetch(`${BASE}/api/webhooks/pathao`, {
    method: "POST",
    headers: { "X-PATHAO-Signature": HOOK, "Content-Type": "application/json" },
    body: JSON.stringify({ event: "webhook_integration" }),
  });
  console.log(`   integration handshake: HTTP ${r.status} (want 202), header ${r.headers.get("x-pathao-merchant-webhook-integration-secret")}`);
}
// an event with no order_status, only the event name
console.log(`   event-name only:       HTTP ${await (async () => {
  const r = await fetch(`${BASE}/api/webhooks/pathao`, {
    method: "POST",
    headers: { "X-PATHAO-Signature": HOOK, "Content-Type": "application/json" },
    body: JSON.stringify({ event: "order.delivered", consignment_id: ship.consignmentId, merchant_order_id: reference, updated_at: "t9" }),
  });
  return r.status;
})()} (want 202)`);

// ---- tracking now shows the courier status
console.log("— /track after the webhook");
await page.goto(`${BASE}/track?ref=${reference}`, { waitUntil: "networkidle" });
await page.fill("#track-phone", PHONE);
await page.getByRole("button", { name: /^Track$/ }).click();
await page.waitForTimeout(1500);
const tracked = await page.locator("main").innerText();
/* The panel under the rail, not a regex over the page — the rail's own step
   labels contain the same words and match first. */
const statusPanel = async () =>
  (await page.locator("main div.border-line.bg-paper").last().innerText()).split("\n")[0].trim();
const currentStep = async () =>
  (await page.locator("main ol li[aria-current=step] span").last().innerText()).trim();
console.log(`   status panel: ${await statusPanel()}`);
console.log(`   current step: ${await currentStep()}`);
console.log(`   courier shown: ${/Pathao/.test(tracked) ? "Pathao" : "none"}`);
console.log(`   tracking code shown: ${tracked.includes(ship.trackingCode)}`);
await shot("track-mobile");

// ---- stale webhook must not move it backwards
console.log("— a stale Pickup_Requested webhook arriving late");
console.log(`   HTTP ${await hook("Pickup_Requested", "t3")}`);
await page.goto(`${BASE}/track?ref=${reference}`, { waitUntil: "networkidle" });
await page.fill("#track-phone", PHONE);
await page.getByRole("button", { name: /^Track$/ }).click();
await page.waitForTimeout(1500);
console.log(`   status panel still: ${await statusPanel()}`);

// ---- confirmation page now carries the rail
await page.goto(orderUrl, { waitUntil: "networkidle" });
const conf = await page.locator("main").innerText();
console.log(`— confirmation page now shows the rail: ${/Out for delivery|On its way|Picked up|Pickup scheduled|Delivered/.test(conf)}, tracking code: ${conf.includes(ship.trackingCode ?? "\u0000")}`);
await shot("order-shipped-mobile");

const w = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
console.log(`— no horizontal overflow: ${w}`);
console.log(errs.length ? "PAGE ERRORS:\n" + errs.join("\n") : "no page errors");
await browser.close();
