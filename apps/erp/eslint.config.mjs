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
