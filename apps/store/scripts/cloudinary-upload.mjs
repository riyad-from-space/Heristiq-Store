/*
 * Upload the site's photography to Cloudinary, named exactly as the code
 * expects. Not part of the app.
 *
 *   node scripts/cloudinary-upload.mjs ~/Desktop/heristiq-photos
 *   node scripts/cloudinary-upload.mjs ~/Desktop/heristiq-photos --dry-run
 *
 * Give it a folder of images. It works out each one's public ID, uploads it,
 * and tells you which of the seventeen the site still wants.
 *
 * WHY A SCRIPT AND NOT THE DASHBOARD. Cloudinary's public ID has to match the
 * id in the catalogue exactly — "wc-005/front", with the slash — and the web
 * uploader names files after whatever came off the camera. Doing seventeen of
 * those by hand, twice (once for the real upload, once when a photo is
 * reshot), is where the mistakes come from.
 *
 * Naming: either works.
 *   wc-005--front.jpg      the -- stands in for the slash
 *   wc-005/front.jpg       a real subfolder
 *   DSC_4821.jpg           no. it will be listed as unrecognised and skipped.
 *
 * Credentials, from apps/store/.env.local or the environment:
 *   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME   also used by the site at runtime
 *   CLOUDINARY_API_KEY                  upload only, never in the browser
 *   CLOUDINARY_API_SECRET
 *
 * Uploads are signed here rather than unsigned-with-a-preset, so no
 * publicly-writable upload preset has to exist on the account.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/*
 * .heic is here because that is what an iPhone actually produces, and the
 * photographs for this shop come off a phone. Cloudinary does accept HEIC,
 * but it is transcoded to a JPEG first (see toUploadable) so the master asset
 * is a format anything can open — including the local public/products/
 * fallback path, which has no transcoder.
 */
const EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".heic", ".heif"]);
const NEEDS_TRANSCODE = new Set([".heic", ".heif"]);

/* The seventeen the site actually renders. Kept here so the script can report
   what is still missing rather than only what was handed to it. */
const WANTED = [
  "wc-001/front", "wc-001/worn",
  "wc-002/front", "wc-002/worn",
  "wc-003/front",
  "wc-004/front", "wc-004/worn",
  "wc-005/front", "wc-005/worn", "wc-005/detail",
  "wc-006/front", "wc-006/detail",
  "wc-007/front", "wc-007/detail",
  "hero/home",
  "story/celestial", "story/nautical",
];

function envFile(file) {
  try {
    return Object.fromEntries(
      readFileSync(file, "utf8")
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

const local = envFile(path.join(import.meta.dirname, "../.env.local"));
const pick = (name) => process.env[name] ?? local[name];

const cloud = pick("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME");
const apiKey = pick("CLOUDINARY_API_KEY");
const apiSecret = pick("CLOUDINARY_API_SECRET");
const folder = pick("NEXT_PUBLIC_CLOUDINARY_FOLDER") || "heristiq";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const dir = args.find((a) => !a.startsWith("--"));

if (!dir) {
  console.error(
    "usage: node scripts/cloudinary-upload.mjs <folder-of-images> [--dry-run]",
  );
  process.exit(2);
}

/** Every image under `dir`, recursively, as { file, id }. */
function collect(root, base = root) {
  const out = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "_r") continue;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...collect(full, base));
      continue;
    }
    if (!EXT.has(path.extname(entry.name).toLowerCase())) continue;

    /*
     * Work out the catalogue id from the filename. Three accepted shapes,
     * all ending up as something like "wc-005/front":
     *
     *   wc-005/front.jpg   a real subfolder
     *   wc-005--front.jpg  the -- stands in for the slash
     *   WC-005.HEIC        just the SKU — means that product's FRONT shot
     *
     * The third is there because it is what comes out of the stockroom: the
     * photographs arrive named after the product code, one per piece, which
     * is the sensible thing for a person to do and used to be reported as
     * "unrecognised". A bare code is unambiguous — a product's first
     * photograph is its front — so it is now simply understood.
     *
     * Lowercased throughout: Cloudinary public IDs are case-sensitive and the
     * catalogue spells them lowercase, so WC-005 and wc-005 must not become
     * two different assets.
     */
    const relative = path.relative(base, full).replace(/\\/g, "/");
    const withoutExt = relative
      .slice(0, -path.extname(relative).length)
      .toLowerCase();
    const id = withoutExt.includes("/")
      ? withoutExt
      : withoutExt.includes("--")
        ? withoutExt.replace(/--/g, "/")
        : /^wc-\d+$/.test(withoutExt)
          ? `${withoutExt}/front`
          : withoutExt;

    out.push({ file: full, id, kb: Math.round(statSync(full).size / 1024) });
  }
  return out;
}

let found;
try {
  found = collect(path.resolve(dir));
} catch (error) {
  console.error(`Cannot read ${dir}: ${error.message}`);
  process.exit(2);
}

if (found.length === 0) {
  console.error(`No images in ${dir}. Looked for ${[...EXT].join(", ")}.`);
  process.exit(2);
}

const recognised = found.filter((f) => WANTED.includes(f.id));
const unrecognised = found.filter((f) => !WANTED.includes(f.id));
const missing = WANTED.filter((id) => !found.some((f) => f.id === id));

console.log(`\nFolder: ${path.resolve(dir)}`);
console.log(`Cloudinary: ${cloud ? `${cloud} (folder "${folder}")` : "NOT CONFIGURED"}\n`);

console.log(`Recognised (${recognised.length}/${WANTED.length}):`);
for (const f of recognised) {
  console.log(`  ${f.id.padEnd(20)} ${String(f.kb).padStart(5)}KB  ${path.basename(f.file)}`);
}

if (unrecognised.length > 0) {
  console.log(`\nSkipped — name does not match any image the site uses:`);
  for (const f of unrecognised) console.log(`  ${path.basename(f.file)}  (read as "${f.id}")`);
  console.log(`  Rename to one of: ${WANTED.map((w) => w.replace("/", "--") + ".jpg").join(", ")}`);
}

if (missing.length > 0) {
  console.log(`\nStill wanted (${missing.length}) — these will keep showing a placeholder:`);
  for (const id of missing) console.log(`  ${id.replace("/", "--")}.jpg`);
}

if (!cloud || !apiKey || !apiSecret) {
  console.error(
    `\nCannot upload: missing ${[
      !cloud && "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME",
      !apiKey && "CLOUDINARY_API_KEY",
      !apiSecret && "CLOUDINARY_API_SECRET",
    ].filter(Boolean).join(", ")}.\n` +
      `Put them in apps/store/.env.local — Cloudinary shows all three on its dashboard.\n`,
  );
  process.exit(dryRun ? 0 : 1);
}

if (dryRun) {
  console.log("\n--dry-run: nothing uploaded.\n");
  process.exit(0);
}

/*
 * Cloudinary's upload signature.
 *
 * Transcribed from their own SDK (cloudinary_npm, lib/utils api_string_to_sign
 * + encode_param) rather than from the prose docs, because the prose leaves out
 * two things that silently produce a 401 saying only "Invalid Signature":
 *
 *   - signature_version 2, which is the DEFAULT, escapes `&` as %26 inside
 *     each `name=value` pair before they are joined;
 *   - null, undefined and empty-string values are dropped, not signed as
 *     empty.
 *
 * Excluded from the signature, per their docs: file, cloud_name,
 * resource_type, api_key. Sort is by parameter name; hash is SHA-1, their
 * default. Verified against their code in scripts/cloudinary-sign-test.mjs.
 */
function sign(params) {
  const canonical = Object.entries(params)
    .map(([key, value]) => [
      String(key),
      Array.isArray(value) ? value.join(",") : value,
    ])
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key}=${value}`.replace(/&/g, "%26"))
    .join("&");

  return createHash("sha1").update(canonical + apiSecret).digest("hex");
}

/*
 * HEIC in, JPEG up.
 *
 * Cloudinary would accept the HEIC, but the stored master would then be a
 * format that nothing else in this repo can read — including the
 * public/products/ fallback, whose resizer is `sips` reading whatever the
 * master happens to be. Transcoding here keeps one predictable master.
 *
 * Quality 92 rather than the default: this is the ONLY generation loss the
 * photograph will suffer, because every delivered size is derived by
 * Cloudinary from this master with q_auto. Being stingy here would be a
 * permanent tax on every rendition.
 *
 * `sips` ships with macOS. On a machine without it the HEIC is uploaded
 * as-is, which Cloudinary handles — the warning says what was skipped.
 */
let scratch = null;
let warnedNoSips = false;

function haveSips() {
  try {
    execFileSync("which", ["sips"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
const SIPS = haveSips();

function toUploadable(file) {
  if (!NEEDS_TRANSCODE.has(path.extname(file).toLowerCase())) return file;
  if (!SIPS) {
    if (!warnedNoSips) {
      console.log("  (no sips on this machine — uploading HEIC unconverted)");
      warnedNoSips = true;
    }
    return file;
  }
  scratch ??= mkdtempSync(path.join(tmpdir(), "heristiq-upload-"));
  const out = path.join(scratch, `${path.basename(file, path.extname(file))}.jpg`);
  execFileSync(
    "sips",
    ["-s", "format", "jpeg", "-s", "formatOptions", "92", file, "--out", out],
    { stdio: "ignore" },
  );
  return out;
}

let uploaded = 0;
let failed = 0;

for (const image of recognised) {
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `${folder}/${image.id}`;

  const signed = {
    public_id: publicId,
    timestamp,
    /* Overwrite, so re-running after a reshoot replaces rather than duplicates.
       Invalidate, so the CDN drops the old copy instead of serving it for
       hours. */
    overwrite: "true",
    invalidate: "true",
  };

  const payload = toUploadable(image.file);

  const form = new FormData();
  form.set("file", new Blob([readFileSync(payload)]), path.basename(payload));
  form.set("api_key", apiKey);
  for (const [key, value] of Object.entries(signed)) form.set(key, String(value));
  form.set("signature", sign(signed));

  process.stdout.write(`  ${image.id.padEnd(20)} `);

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloud}/image/upload`,
      { method: "POST", body: form, signal: AbortSignal.timeout(120_000) },
    );
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.log(`FAILED — ${body?.error?.message ?? response.status}`);
      failed += 1;
      continue;
    }

    console.log(`ok  ${body.width}×${body.height}  ${Math.round(body.bytes / 1024)}KB`);
    uploaded += 1;
  } catch (error) {
    console.log(`FAILED — ${error}`);
    failed += 1;
  }
}

if (scratch) rmSync(scratch, { recursive: true, force: true });

console.log(`\n${uploaded} uploaded, ${failed} failed.`);
if (uploaded > 0) {
  console.log(
    `\nThe site picks these up immediately — no rebuild. Check one:\n` +
      `  https://res.cloudinary.com/${cloud}/image/upload/f_auto,q_auto,w_640/${folder}/${recognised[0].id}\n`,
  );
}
process.exit(failed === 0 ? 0 : 1);
