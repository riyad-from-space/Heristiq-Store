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
    /*
     * A manifest carries ONE colour and is read at install time, long before
     * any theme choice exists — there is no media-query form here the way
     * there is for the viewport's themeColor. So these stay the light values:
     * the splash screen a customer sees when they open the installed shop
     * matches the default the site ships with, and once the app is running the
     * page itself follows their theme normally.
     */
    background_color: "#faf7f2",
    theme_color: "#faf7f2",
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
    ],
  };
}
