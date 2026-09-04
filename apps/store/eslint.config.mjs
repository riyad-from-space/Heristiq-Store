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
       * This project serves every image through Cloudinary, which already
       * resizes, re-encodes (AVIF/WebP via f_auto) and serves from a CDN edge.
       * next/image in front of that means two resizes and two caches for one
       * picture, and on the Cloudflare Workers deploy target it needs a runtime
       * image binding that a plain <img> does not.
       *
       * The srcset/sizes/fetchPriority work the rule exists to enforce is done
       * by hand in src/lib/cloudinary.ts and src/components/ui/product-image.tsx.
       * Off project-wide rather than disabled at each call site, so the reason
       * is stated once.
       */
      "@next/next/no-img-element": "off",

      /*
       * An underscore marks a parameter that is deliberately unused.
       *
       * The courier layer needs this: Pathao and RedX implement
       * CourierProvider as stubs (see src/lib/courier/pathao.ts for why), and
       * a stub that keeps its parameter names documents what the method will
       * receive when someone finishes it. Dropping the names to satisfy the
       * linter would throw that away.
       */
      /*
       * The storefront must not import the ERP.
       *
       * When these were two repositories this was impossible; in one workspace
       * it is merely unwise, so it is a rule. The storefront runs with the
       * SUPABASE service-role key and is public; the ERP is an authenticated
       * admin app. Pulling an ERP module in here would put admin code — and
       * cost, margin and supplier data — one bundling mistake away from a
       * customer's browser.
       *
       * Shared rules belong in packages/shared, which both may import.
       */
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/apps/erp/*", "@heristiq/erp", "@heristiq/erp/*"],
              message:
                "The storefront must not import the ERP app. Put anything shared in packages/shared.",
            },
          ],
        },
      ],

      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
