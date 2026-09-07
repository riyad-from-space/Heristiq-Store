import type { MetadataRoute } from "next";
import { site } from "@/config/site";

/*
 * The web app manifest, so the shop can be added to a phone's home screen —
 * which for a business run from a phone in Bangladesh is a more realistic
 * install path than any app store.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${site.name} — ${site.tagline}`,
    short_name: site.name,
    description: site.description,
    start_url: "/",
    display: "standalone",
    background_color: "#faf7f2",
    theme_color: "#faf7f2",
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
    ],
  };
}
