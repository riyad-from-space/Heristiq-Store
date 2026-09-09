import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    /*
     * The Cloudflare build output, and the reason it is here.
     *
     * globalIgnores REPLACES eslint-config-next's defaults rather than adding
     * to them, so anything not listed above is linted — and
     * `opennextjs-cloudflare build` writes 32 MB of bundled worker into
     * .open-next/. Linting that exhausts the default 2 GB heap and ESLint dies
     * with "Ineffective mark-compacts near heap limit", which makes
     * `npm run build && npm run lint` impossible to run in that order and
     * would break any CI job or pre-deploy check that does.
     *
     * Both are generated, both are gitignored, and neither is ours to lint.
     */
    ".open-next/**",
    ".wrangler/**",
  ]),
  {
    rules: {
      /*
       * The ERP must not import the storefront either.
       *
       * The dangerous direction is the other one — see apps/store's copy of
       * this rule — but the reverse is worth blocking too: the storefront's
       * modules assume a public request with no signed-in user, and reaching
       * into them from an admin page would couple the two deployments through
       * assumptions neither states. Shared rules go in packages/shared.
       */
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/apps/store/*", "@heristiq/store", "@heristiq/store/*"],
              message:
                "The ERP must not import the storefront app. Put anything shared in packages/shared.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
