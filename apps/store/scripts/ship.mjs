/*
 * Push an order to its courier from the command line. Not part of the app.
 *
 *   node scripts/ship.mjs HQ-01042 [steadfast|pathao|redx]
 *
 * The same endpoint phase 6's admin button will call, so this is the fastest
 * way to use the one-tap push today — and the fastest way to check that
 * Steadfast credentials actually work against a real order.
 *
 * Reads ADMIN_TOKEN and STORE_URL from .env.local (or the environment).
 */
import { readFileSync } from "node:fs";

function envFile(path = ".env.local") {
  try {
    return Object.fromEntries(
      readFileSync(path, "utf8")
        .split("\n")
        .filter((line) => line.trim() && !line.trim().startsWith("#"))
        .map((line) => {
          const at = line.indexOf("=");
          return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
        }),
    );
  } catch {
    return {};
  }
}

const file = envFile();
const token = process.env.ADMIN_TOKEN ?? file.ADMIN_TOKEN;
const base = process.env.STORE_URL ?? file.STORE_URL ?? "http://localhost:3000";
const [reference, courier] = process.argv.slice(2);

if (!reference) {
  console.error("usage: node scripts/ship.mjs HQ-01042 [steadfast|pathao|redx]");
  process.exit(2);
}
if (!token) {
  console.error("ADMIN_TOKEN is not set (environment or .env.local).");
  process.exit(2);
}

const response = await fetch(
  `${base.replace(/\/$/, "")}/api/admin/orders/${encodeURIComponent(reference)}/ship`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(courier ? { courier } : {}),
  },
);

const body = await response.json().catch(() => ({}));
console.log(`HTTP ${response.status}`);
console.dir(body, { depth: null });

if (body.riskNote) {
  console.log(`\n  ⚠ ${body.riskNote}\n`);
}
if (body.demo) {
  console.log("\n  Demo mode: no ERP credentials, so nothing was really shipped.\n");
}

process.exit(response.ok ? 0 : 1);
