import type { MetadataRoute } from "next";
import { erp } from "@/lib/erp";
import { site } from "@/config/site";

/*
 * The sitemap, built from the live catalogue.
 *
 * Product URLs come from the ERP rather than a hand-kept list, so a piece
 * added on the Products page is discoverable without a deploy. Filtered shop
 * URLs are deliberately absent: /shop?finish=gold is the same seven products
 * in a different order, and it is already marked noindex.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = site.url.replace(/\/$/, "");

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/shop`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/about`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${base}/shipping`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/size-guide`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${base}/contact`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/track`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/policies/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/policies/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];

  try {
    const products = await erp().getProducts();
    return [
      ...staticPages,
      ...products.map((product) => ({
        url: `${base}/shop/${product.slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ];
  } catch (error) {
    /* A sitemap missing its products is far better than a 500 at /sitemap.xml,
       which makes a crawler drop the whole file. */
    console.error("[sitemap] catalogue read failed", error);
    return staticPages;
  }
}
