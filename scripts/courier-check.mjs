/*
 * Check that Steadfast credentials actually work. Not part of the app.
 *
 *   node scripts/courier-check.mjs
 *
 * Calls get_balance, which is the only Steadfast endpoint that proves the base
 * URL, the two auth headers AND the credentials are all right without creating
 * anything. Worth running once before the first real order goes out.
 *
 * It exists because the exact header names (`Api-Key` / `Secret-Key`) come
 * from Steadfast's v1 documentation rather than from a request this codebase
 * has ever made against a live account. If they have changed, this is where it
 * shows up — as a 401 with the exact URL and header names it tried, instead of
 * as a failed order push at 9pm.
 *
 * Reads STEADFAST_* from .env.local or the environment.
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
const pick = (name) => process.env[name] ?? file[name];

const base = (pick("STEADFAST_BASE_URL") ?? "https://portal.steadfast.com.bd/api/v1").replace(/\/$/, "");
const apiKey = pick("STEADFAST_API_KEY");
const secretKey = pick("STEADFAST_SECRET_KEY");

if (!apiKey || !secretKey) {
  console.error("STEADFAST_API_KEY and STEADFAST_SECRET_KEY are not set (environment or .env.local).");
  process.exit(2);
}

const url = `${base}/get_balance`;
console.log(`GET ${url}`);
console.log(`     Api-Key: ${apiKey.slice(0, 4)}…  Secret-Key: ${secretKey.slice(0, 4)}…\n`);

let response;
try {
  response = await fetch(url, {
    headers: {
      "Api-Key": apiKey,
      "Secret-Key": secretKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15000),
  });
} catch (error) {
  console.error(`Could not reach Steadfast: ${error}`);
  process.exit(1);
}

const text = await response.text();
console.log(`HTTP ${response.status}`);
console.log(text.slice(0, 500));

let body = null;
try {
  body = JSON.parse(text);
} catch {
  console.error("\nThat is not JSON — the base URL is probably wrong.");
  process.exit(1);
}

if (response.ok && body?.status === 200) {
  console.log(`\n  ✓ Credentials work. Current balance: ৳${body.current_balance}`);
  process.exit(0);
}

console.error(
  "\n  ✗ Steadfast refused it. Check the API key and secret in their portal, and\n" +
    "    that the header names above still match their current documentation.\n" +
    "    Try STEADFAST_BASE_URL=https://portal.packzy.com/api/v1 — they serve the\n" +
    "    same API from both hostnames and have moved between them.",
);
process.exit(1);
