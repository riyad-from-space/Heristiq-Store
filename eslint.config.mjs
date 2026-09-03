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
    },
  },
]);

export default eslintConfig;
