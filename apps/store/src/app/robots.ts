import type { MetadataRoute } from "next";
import { site } from "@/config/site";

/*
 * robots.txt.
 *
 * The disallows are the point. /checkout, /cart and /order/* are per-customer
 * — /order in particular is a real person's name, phone and address behind an
 * unguessable token, and a crawler that found one link would index it. /admin
 * is the ERP, and /api is machinery.
 */
export default function robots(): MetadataRoute.Robots {
  const base = site.url.replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/cart", "/checkout", "/order/", "/admin", "/api/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
