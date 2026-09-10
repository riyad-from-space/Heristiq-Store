/*
 * Does every photograph the site asks for actually exist?
 *
 *   npm run images:check                       # against cloudinary_images/
 *   node scripts/images-check.mjs ~/some/dir   # against another folder
 *
 * WHY THIS EXISTS. An image id in the catalogue that has no photograph behind
 * it does NOT fall back to the designed placeholder — the placeholder only
 * appears when a product's image list is EMPTY. A single bad id produces a
 * real request that 404s, and the customer sees a browser's broken-image icon
 * on a product page. Nothing else catches it: TypeScript sees a valid string,
 * the build succeeds, and the page renders.
 *
 * That is not hypothetical. The catalogue shipped referencing seventeen
 * photographs when ten existed — seven products would have shown a broken
 * gallery thumbnail the day Cloudinary was switched on.
 *
 * It reports both directions, because both are mistakes worth knowing about:
 * an id with no photograph is a broken image, and a photograph no id refers
 * to is a shoot nobody is using.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const DROP = process.argv[2] ?? path.join(ROOT, "../../cloudinary_images");

/*
 * ALL of src/, walked — not a list of files that name images.
 *
 * It was a list of four, and that is precisely how six broken tiles reached
 * the home page: the Instagram row built its ids as `social/${n}` in a file
 * the list did not include, so nothing checked them, and they 404'd the day
 * Cloudinary was configured. A hardcoded list only ever verifies the places
 * someone remembered, which is the wrong set by construction.
 */
function sources(dir, base = dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      sources(full, base, out);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name)) out.push(path.relative(base, full));
  }
  return out;
}

const SRC = path.join(ROOT, "src");
const SOURCES = sources(SRC).map((f) => path.join("src", f));

const EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".heic", ".heif"]);

/* The uploader's naming rules, kept identical on purpose: a nested path is
   the id, `--` stands in for the slash, and a bare SKU is that product's
   front shot. If these two ever disagree, this check silently stops meaning
   anything — so any change to one belongs in the other. */
function idFor(relative) {
  const withoutExt = relative
    .slice(0, -path.extname(relative).length)
    .toLowerCase();
  if (withoutExt.includes("/")) return withoutExt;
  if (withoutExt.includes("--")) return withoutExt.replace(/--/g, "/");
  if (/^wc-\d+$/.test(withoutExt)) return `${withoutExt}/front`;
  return withoutExt;
}

function available(root, base = root) {
  const out = new Set();
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "_r") continue;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      for (const id of available(full, base) ?? []) out.add(id);
      continue;
    }
    if (!EXT.has(path.extname(entry.name).toLowerCase())) continue;
    out.add(idFor(path.relative(base, full).replace(/\\/g, "/")));
  }
  return out;
}

/*
 * Ids referenced from source.
 *
 * Commented-out lines are skipped, and that is the point rather than an
 * oversight: the catalogue parks the shots it does not have yet as `// { id:
 * ... }` so restoring one after a shoot is uncommenting a line. A commented
 * id is a plan, not a request, and must not be reported as missing.
 */
const generated = [];

function referenced() {
  const found = new Map();
  for (const file of SOURCES) {
    const full = path.join(ROOT, file);
    let text;
    try {
      text = readFileSync(full, "utf8");
    } catch {
      console.log(`  note  ${file} — not found, skipped`);
      continue;
    }
    text.split("\n").forEach((line, index) => {
      if (/^\s*(\/\/|\*)/.test(line)) return;

      /*
       * An id built by interpolation can never be checked from here, so it is
       * reported rather than ignored — silence would recreate the exact bug
       * this script exists to catch. Put the ids in a config array instead;
       * a literal is verifiable, `social/${n}` is not.
       *
       * The `/` requirement is what keeps this from crying wolf: an image id
       * is always a path, so `mock-order-${seq}` is an order and none of this
       * script's business, while `${sku}/front` is a photograph.
       */
      if (/\bid:\s*`[^`]*\$\{/.test(line) && /\bid:\s*`[^`]*\//.test(line)) {
        generated.push(`${file}:${index + 1}  ${line.trim().slice(0, 60)}`);
        return;
      }

      for (const match of line.matchAll(/\bid:\s*"([a-z0-9][a-z0-9/-]*)"/g)) {
        const id = match[1];
        /* An id is a path with a slash. Anything else on an `id:` key is a
           DOM id or a config key, not a photograph. */
        if (!id.includes("/")) continue;
        if (!found.has(id)) found.set(id, `${file}:${index + 1}`);
      }
    });
  }
  return found;
}

const have = available(path.resolve(DROP));
if (have === null) {
  console.error(`\nCannot read the photograph folder: ${path.resolve(DROP)}\n`);
  process.exit(2);
}

const want = referenced();

console.log(`\nPhotographs: ${path.resolve(DROP)}`);
console.log(`Referenced by: ${SOURCES.length} source files\n`);

const missing = [...want].filter(([id]) => !have.has(id));
const unused = [...have].filter((id) => !want.has(id));

console.log(`Referenced and present (${want.size - missing.length}/${want.size}):`);
for (const [id, where] of want) {
  if (have.has(id)) console.log(`   ok   ${id.padEnd(20)} ${where}`);
}

if (missing.length > 0) {
  console.log(`\nBROKEN — referenced with no photograph behind it:`);
  for (const [id, where] of missing) {
    console.log(`  FAIL  ${id.padEnd(20)} ${where}`);
    console.log(`        add ${id.replace("/", "--")}.jpg, or comment the line out`);
  }
}

if (unused.length > 0) {
  console.log(`\nPresent but unused — uploaded, and nothing renders it:`);
  for (const id of unused) console.log(`  note  ${id}`);
}

if (generated.length > 0) {
  console.log(`\nUNVERIFIABLE — id built by interpolation, so nothing can check it:`);
  for (const where of generated) console.log(`  WARN  ${where}`);
  console.log(`        move the ids into a config array so they are literals`);
}

console.log(
  missing.length
    ? `\n${missing.length} would render as a broken image.\n`
    : `\nEvery referenced photograph exists.\n`,
);
process.exit(missing.length ? 1 : 0);
