/*
 * Does every product photograph actually RENDER, at every size the site ships?
 *
 *   node scripts/renditions-check.mjs            every product image
 *   node scripts/renditions-check.mjs BR-002     one SKU
 *
 * WHY THIS EXISTS. images-check.mjs answers "does the file exist?" — and the
 * file existing is not the same as the shop being able to show it.
 *
 * An iPhone HEIC uploaded to Cloudinary passes every check that came before
 * this one: the upload returns 200, the dimensions come back correct, the row
 * is written, the thumbnail loads. Then the transformer fails on SOME
 * renditions with "Cannot read grid descriptor", because HEIC stores the
 * picture as a grid of tiles the decoder cannot always read. Measured on a real
 * photograph: 16 of 21 renditions worked from a HEIC master, 21 of 21 from a
 * JPEG one.
 *
 * The failure mode is what makes it worth a script. A 400 from Cloudinary is
 * CACHED, so it does not clear on a retry. It hits only some widths, so the
 * page looks fine on the phone you tested and broken on a customer's. And the
 * browser shows a broken-image icon rather than the designed placeholder,
 * because the placeholder only appears when a product has NO images at all.
 *
 * Nothing else catches this: TypeScript sees a valid string, the build
 * succeeds, the page renders, and the row is in the database.
 *
 * Reads the catalogue from Supabase, so it checks what is actually live.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");

function env() {
  const merged = {};
  for (const file of [".env.local", ".env"]) {
    try {
      for (const line of readFileSync(path.join(ROOT, file), "utf8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
        const at = trimmed.indexOf("=");
        merged[trimmed.slice(0, at).trim()] ??= trimmed.slice(at + 1).trim();
      }
    } catch {
      /* not there, fine */
    }
  }
  return { ...merged, ...process.env };
}

const E = env();
const SUPABASE = (E.SUPABASE_URL ?? E.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE = E.SUPABASE_SERVICE_ROLE_KEY;
const CLOUD = E.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? E.CLOUDINARY_CLOUD_NAME;
const FOLDER = E.NEXT_PUBLIC_CLOUDINARY_FOLDER ?? E.CLOUDINARY_FOLDER ?? "heristiq";

if (!SUPABASE || !SERVICE || !CLOUD) {
  console.log("Needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and a Cloudinary cloud name.");
  process.exit(0);
}

/* Must match lib/cloudinary.ts. A width the site ships and this does not check
   is a width that can be broken without anyone knowing. */
const WIDTHS = [320, 480, 640, 828, 1080, 1440, 1920];
const SHAPES = [
  ["portrait", "ar_4:5,c_fill,g_auto"],
  ["square", "ar_1:1,c_fill,g_auto"],
  ["natural", "c_limit"],
];

const only = process.argv[2]?.toUpperCase();

const res = await fetch(
  `${SUPABASE}/rest/v1/product_images?select=public_id,format,width,height`,
  { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } },
);
if (!res.ok) {
  console.log(`Could not read product_images: ${res.status}`);
  process.exit(1);
}
let rows = await res.json();
if (only) rows = rows.filter((r) => r.public_id.toUpperCase().includes(only));

if (rows.length === 0) {
  console.log(only ? `No photographs matching ${only}.` : "No photographs in the database yet.");
  process.exit(0);
}

console.log(`Checking ${rows.length} photograph(s) x ${WIDTHS.length} widths x ${SHAPES.length} shapes\n`);

/* One rendition, with retries — a cold rendition is generated on first request
   and a slow generation can time out once without being broken. A CACHED 400
   fails all three times, which is exactly the case worth reporting. */
async function check(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, {
        headers: { Accept: "image/avif,image/webp,*/*", "User-Agent": "Mozilla/5.0" },
      });
      if (r.ok) return null;
      if (i === tries - 1) return r.headers.get("x-cld-error") ?? `HTTP ${r.status}`;
    } catch (cause) {
      if (i === tries - 1) return cause.message;
    }
  }
  return "unknown";
}

const failures = [];
let checked = 0;

for (const row of rows.sort((a, b) => a.public_id.localeCompare(b.public_id))) {
  const sku = row.public_id.split("/")[1] ?? row.public_id;
  const cells = [];

  for (const [shapeName, shape] of SHAPES) {
    let ok = 0;
    for (const width of WIDTHS) {
      const url = `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,w_${width},${shape}/${FOLDER}/${row.public_id}`;
      const problem = await check(url);
      checked += 1;
      if (problem) failures.push(`${sku}  w_${width} ${shapeName}  ${problem}`);
      else ok += 1;
    }
    cells.push(`${shapeName} ${ok}/${WIDTHS.length}`);
  }

  const bad = cells.some((c) => !c.endsWith(`${WIDTHS.length}/${WIDTHS.length}`));
  console.log(`  ${bad ? "FAIL" : " ok "}  ${sku.padEnd(8)} [${String(row.format).padEnd(4)}] ${cells.join("  ")}`);
}

console.log(`\n${checked} renditions checked, ${failures.length} broken`);
for (const f of failures) console.log(`  ${f}`);

if (failures.some((f) => /grid descriptor/i.test(f))) {
  console.log(
    "\n'Cannot read grid descriptor' means a HEIC master. Cloudinary cannot\n" +
      "reliably resize one — re-upload it and the ERP will store it as JPEG.",
  );
}

process.exit(failures.length === 0 ? 0 : 1);
