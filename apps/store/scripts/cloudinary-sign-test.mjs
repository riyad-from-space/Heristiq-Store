/*
 * Verify our upload signature against Cloudinary's own implementation.
 *
 *   node scripts/cloudinary-sign-test.mjs
 *
 * The two functions below are transcribed VERBATIM from cloudinary_npm
 * (lib/utils/index.js: api_string_to_sign, encode_param). They are the oracle;
 * ours has to agree with them. This is the one part of the upload path that
 * cannot be checked by running it — a wrong signature returns a 401 whose body
 * says only "Invalid Signature", with no hint as to which rule was broken.
 */
import { createHash } from "node:crypto";

/* ---- Cloudinary's, verbatim ---------------------------------------------- */
function encode_param(value) {
  return String(value).replace(/&/g, "%26");
}

function api_string_to_sign(params_to_sign, signature_version = 2) {
  let params = Object.entries(params_to_sign)
    .map(([k, v]) => [String(k), Array.isArray(v) ? v.join(",") : v])
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- verbatim from their source
    .filter(([k, v]) => v !== null && v !== undefined && v !== "");
  params.sort((a, b) => a[0].localeCompare(b[0]));
  let paramStrings = params.map(([k, v]) => {
    const paramString = `${k}=${v}`;
    return signature_version >= 2 ? encode_param(paramString) : paramString;
  });
  return paramStrings.join("&");
}

const theirs = (params, secret) =>
  createHash("sha1").update(api_string_to_sign(params) + secret).digest("hex");

/* ---- ours, copied from cloudinary-upload.mjs ----------------------------- */
const ours = (params, secret) => {
  const canonical = Object.entries(params)
    .map(([key, value]) => [
      String(key),
      Array.isArray(value) ? value.join(",") : value,
    ])
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key}=${value}`.replace(/&/g, "%26"))
    .join("&");
  return createHash("sha1").update(canonical + secret).digest("hex");
};

const secret = "test-api-secret-not-a-real-one";
const cases = [
  ["the real payload", { public_id: "heristiq/wc-005/front", timestamp: 1757239200, overwrite: "true", invalidate: "true" }],
  ["keys out of order", { timestamp: 1757239200, invalidate: "true", public_id: "heristiq/hero/home", overwrite: "true" }],
  ["an & in the id", { public_id: "heristiq/gold&silver/front", timestamp: 1757239200 }],
  ["an empty value is dropped", { public_id: "heristiq/wc-001/front", folder: "", timestamp: 1757239200 }],
  ["a null value is dropped", { public_id: "heristiq/wc-001/worn", context: null, timestamp: 1757239200 }],
  ["an array value joins with a comma", { public_id: "heristiq/wc-002/front", tags: ["a", "b"], timestamp: 1757239200 }],
  ["uppercase sorts before lowercase", { Z: "1", a: "2", timestamp: 1757239200 }],
  ["just a timestamp", { timestamp: 1757239200 }],
];

let pass = 0, fail = 0;
for (const [label, params] of cases) {
  const t = theirs(params, secret), o = ours(params, secret);
  const ok = t === o;
  console.log(`  ${ok ? "✓" : "✗"} ${label}`);
  if (!ok) console.log(`      theirs ${t}\n      ours   ${o}\n      signed "${api_string_to_sign(params)}"`);
  if (ok) pass += 1;
  else fail += 1;
}
console.log(`\n${pass} agree, ${fail} differ\n`);
process.exit(fail === 0 ? 0 : 1);
