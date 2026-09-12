/*
 * Does the ERP's upload signature agree with Cloudinary's own?
 *
 *   node --experimental-strip-types scripts/cloudinary-sign-test.mjs
 *
 * WHY THIS EXISTS. Signing is the one part of the upload path that cannot be
 * checked by running it: a wrong signature returns a 401 whose entire body is
 * "Invalid Signature", naming neither the parameter nor the rule. And it fails
 * for the OWNER, on their phone, holding a photograph they wanted to sell.
 *
 * The functions in the first section are transcribed VERBATIM from
 * cloudinary_npm (lib/utils/index.js: api_string_to_sign, encode_param). They
 * are the oracle. Ours has to agree with them.
 *
 * Crucially this imports the REAL signParams from src/lib/cloudinary-sign.ts —
 * the same function the server actually calls. The storefront's equivalent
 * test checks a pasted copy, which can drift from the original without either
 * one failing. This cannot.
 */
import { createHash } from "node:crypto";
import { signParams } from "../src/lib/cloudinary-sign.ts";

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

/* ---- the cases ----------------------------------------------------------- */
const SECRET = "a-secret-that-is-not-the-real-one";

const CASES = [
  {
    name: "a plain upload ticket",
    params: { public_id: "heristiq/products/WC-008/m1a2b3c4", timestamp: 1757000000 },
  },
  {
    name: "a destroy call, invalidate included",
    params: {
      public_id: "heristiq/products/WC-008/m1a2b3c4",
      timestamp: 1757000000,
      invalidate: "true",
    },
  },
  {
    name: "parameters out of alphabetical order",
    params: { timestamp: 1757000000, public_id: "heristiq/a", invalidate: "true" },
  },
  {
    /* The rule the prose docs omit. A public_id containing & must be escaped
       inside its own pair BEFORE the pairs are joined with &, or the joined
       string is ambiguous and the hash differs. */
    name: "an ampersand in a value (signature_version 2 escaping)",
    params: { public_id: "heristiq/products/B&W/x1", timestamp: 1757000000 },
  },
  {
    /* The other omitted rule: empty values are DROPPED, not signed as empty. */
    name: "an empty value is dropped, not signed",
    params: { public_id: "heristiq/a", timestamp: 1757000000, folder: "" },
  },
  {
    name: "a numeric zero is signed, not treated as empty",
    params: { public_id: "heristiq/a", timestamp: 1757000000, overwrite: 0 },
  },
  {
    name: "unicode in the id",
    params: { public_id: "heristiq/products/চেইন/x1", timestamp: 1757000000 },
  },
];

let failed = 0;

for (const testCase of CASES) {
  const expected = theirs(testCase.params, SECRET);
  const actual = await signParams(testCase.params, SECRET);
  const pass = expected === actual;
  if (!pass) failed += 1;
  console.log(`${pass ? "PASS" : "FAIL"}  ${testCase.name}`);
  if (!pass) {
    console.log(`        cloudinary: ${expected}`);
    console.log(`        ours:       ${actual}`);
  }
}

/* A test that only ever compares two implementations can pass because both are
   broken in the same way. Prove the comparison can actually fail. */
const drifted = await signParams(
  { public_id: "heristiq/a", timestamp: 1757000001 },
  SECRET,
);
const baseline = theirs({ public_id: "heristiq/a", timestamp: 1757000000 }, SECRET);
if (drifted === baseline) {
  console.log("FAIL  the comparison is not actually comparing anything");
  failed += 1;
} else {
  console.log("PASS  a different timestamp really does produce a different hash");
}

console.log(failed === 0 ? "\nall pass" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
