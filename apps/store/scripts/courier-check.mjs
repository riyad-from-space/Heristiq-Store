/*
 * Check that courier credentials actually work. Not part of the app.
 *
 *   node scripts/courier-check.mjs            # whichever couriers are configured
 *
 * For Pathao this is the script that gets you set up, not just a health check.
 * It issues a token, lists your stores (PATHAO_STORE_ID has to be one of them,
 * and there is no other way to discover the id), lists their cities, and then
 * resolves a sample address through the same matcher the app uses — which is
 * the step most likely to be wrong, because Pathao does not take an address at
 * all, only city/zone/area ids from its own taxonomy.
 *
 * For Steadfast it calls get_balance, the only endpoint that proves the base
 * URL, both auth headers and the credentials together while creating nothing.
 *
 * Reads PATHAO_* and STEADFAST_* from .env.local or the environment.
 */
import { readFileSync } from "node:fs";
import { resolveLocation } from "../src/lib/courier/pathao-locations.ts";

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
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => console.log(`  ✗ ${m}`);

let failures = 0;

/* ------------------------------------------------------------------ Pathao */
async function checkPathao() {
  const clientId = pick("PATHAO_CLIENT_ID");
  const clientSecret = pick("PATHAO_CLIENT_SECRET");
  const username = pick("PATHAO_USERNAME");
  const password = pick("PATHAO_PASSWORD");
  const storeId = pick("PATHAO_STORE_ID");

  if (!clientId || !clientSecret || !username || !password) {
    console.log("\nPathao — not configured, skipping.");
    return;
  }

  const base = (
    pick("PATHAO_BASE_URL") ??
    (pick("PATHAO_ENVIRONMENT")?.toLowerCase() === "sandbox"
      ? "https://courier-api-sandbox.pathao.com"
      : "https://api-hermes.pathao.com")
  ).replace(/\/$/, "");

  console.log(`\nPathao — ${base}`);

  const call = async (path, options = {}) => {
    const response = await fetch(`${base}/${path}`, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options.token && { Authorization: `Bearer ${options.token}` }),
      },
      ...(options.body && { body: JSON.stringify(options.body) }),
      signal: AbortSignal.timeout(20000),
    });
    const text = await response.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      /* left null — reported by the caller */
    }
    return { status: response.status, body, text };
  };

  const auth = await call("aladdin/api/v1/issue-token", {
    method: "POST",
    body: {
      client_id: clientId,
      client_secret: clientSecret,
      username,
      password,
      grant_type: "password",
    },
  });

  const token = auth.body?.access_token ?? auth.body?.data?.access_token;
  if (!token) {
    bad(`issue-token failed (HTTP ${auth.status}): ${auth.text.slice(0, 200)}`);
    failures += 1;
    return;
  }
  ok(`token issued, expires in ${auth.body?.expires_in ?? "?"}s`);

  const stores = await call("aladdin/api/v1/stores", { token });
  const storeList = stores.body?.data?.data ?? [];
  if (storeList.length === 0) {
    bad(`no stores returned (HTTP ${stores.status}) — create one in the merchant panel`);
    failures += 1;
  } else {
    ok(`${storeList.length} store(s):`);
    for (const store of storeList) {
      const marker = String(store.store_id) === String(storeId) ? " ← PATHAO_STORE_ID" : "";
      console.log(`      ${store.store_id}  ${store.store_name}${marker}`);
    }
    if (!storeId) {
      bad("PATHAO_STORE_ID is not set — copy one of the ids above into it");
      failures += 1;
    } else if (!storeList.some((s) => String(s.store_id) === String(storeId))) {
      bad(`PATHAO_STORE_ID=${storeId} is not one of your stores`);
      failures += 1;
    }
  }

  const cities = await call("aladdin/api/v1/countries/1/city-list", { token });
  const cityList = cities.body?.data?.data ?? [];
  if (cityList.length === 0) {
    bad(`city-list returned nothing (HTTP ${cities.status})`);
    failures += 1;
    return;
  }
  ok(`${cityList.length} cities`);

  /*
   * Resolve a real address end to end, through the same code the push uses.
   * Dhaka/Mirpur because it is the commonest destination and Pathao splits
   * Mirpur into numbered zones, which is exactly the case worth proving.
   */
  const district = process.argv[2] ?? "Dhaka";
  const area = process.argv[3] ?? "Mirpur";

  const cityProbe = resolveLocation({
    districtName: district,
    areaName: "probe",
    cities: cityList,
    zonesFor: () => [{ zone_id: -1, zone_name: "probe" }],
    areasFor: () => [],
  });

  if (!cityProbe.ok) {
    bad(`no Pathao city matches the district "${district}"`);
    failures += 1;
    return;
  }

  const cityId = cityProbe.location.cityId;
  const zones = await call(`aladdin/api/v1/cities/${cityId}/zone-list`, { token });
  const zoneList = zones.body?.data?.data ?? [];
  const resolved = resolveLocation({
    districtName: district,
    areaName: area,
    cities: cityList,
    zonesFor: () => zoneList,
    areasFor: () => [],
  });

  if (!resolved.ok) {
    bad(`"${district} / ${area}" did not resolve: ${resolved.reason}`);
    failures += 1;
    return;
  }

  ok(
    `"${district} / ${area}" → city ${resolved.location.cityId} (${resolved.location.cityName}), ` +
      `zone ${resolved.location.zoneId} (${resolved.location.zoneName}), match: ${resolved.location.match}`,
  );
  if (resolved.location.match === "fuzzy") {
    console.log(
      "      note: a fuzzy match. Check the zone is right; if not, correct it once in\n" +
        "      storefront_courier_zones (source='manual') and it will stay corrected.",
    );
  }
}

/* --------------------------------------------------------------- Steadfast */
async function checkSteadfast() {
  const apiKey = pick("STEADFAST_API_KEY");
  const secretKey = pick("STEADFAST_SECRET_KEY");
  if (!apiKey || !secretKey) {
    console.log("\nSteadfast — not configured, skipping.");
    return;
  }

  const base = (pick("STEADFAST_BASE_URL") ?? "https://portal.steadfast.com.bd/api/v1").replace(/\/$/, "");
  console.log(`\nSteadfast — ${base}`);

  let response;
  try {
    response = await fetch(`${base}/get_balance`, {
      headers: {
        "Api-Key": apiKey,
        "Secret-Key": secretKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    bad(`unreachable: ${error}`);
    failures += 1;
    return;
  }

  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    bad("response is not JSON — the base URL is probably wrong");
    failures += 1;
    return;
  }

  if (response.ok && body?.status === 200) {
    ok(`credentials work, balance ৳${body.current_balance}`);
  } else {
    bad(`refused (HTTP ${response.status}): ${text.slice(0, 200)}`);
    console.log(
      "      Check the keys, and that the Api-Key / Secret-Key header names still\n" +
        "      match their docs. Also try STEADFAST_BASE_URL=https://portal.packzy.com/api/v1",
    );
    failures += 1;
  }
}

await checkPathao();
await checkSteadfast();

if (!pick("PATHAO_CLIENT_ID") && !pick("STEADFAST_API_KEY")) {
  console.log(
    "\nNo courier is configured. Outside production the demo courier stands in, so the\n" +
      "push and tracking flows still work — see src/lib/courier/demo.ts.\n",
  );
  process.exit(0);
}

console.log(failures === 0 ? "\nAll good.\n" : `\n${failures} problem(s).\n`);
process.exit(failures === 0 ? 0 : 1);
