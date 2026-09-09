/**
 * Theme: light, dark, or follow the system.
 *
 * ---------------------------------------------------------------------------
 * Why localStorage and not a cookie
 *
 * A cookie is the tempting choice, because the server could then render the
 * right theme into the HTML and there would be nothing to do on the client.
 * It is the wrong choice here, and the reason is caching.
 *
 * Reading a cookie in a server component opts that route out of static
 * rendering. app/page.tsx is `export const revalidate = 300` — one render
 * served from Cloudflare's edge for five minutes to every visitor — and that
 * is the page the Instagram traffic lands on. Making it vary by cookie turns
 * one cached render into a render per request, to decide a colour. The
 * about/policies/size-guide routes are prerendered for the same reason and
 * would also become dynamic.
 *
 * So the theme is applied by the small script below, before first paint, and
 * the server keeps emitting one cacheable HTML document that works in both
 * themes. The trade is that the server cannot know the theme — which is fine,
 * because nothing on the server needs to.
 *
 * ---------------------------------------------------------------------------
 * Why the attribute is only set for an EXPLICIT choice
 *
 * `system` deliberately leaves no attribute on <html>. That lets the CSS in
 * globals.css resolve it with `prefers-color-scheme`, which means the correct
 * theme also applies when JavaScript never runs — the same population the
 * scroll-reveal <noscript> guard exists for. If this script always stamped an
 * attribute, a JS-off visitor would be locked to light regardless of their OS.
 *
 * The resulting precedence is: [data-theme] if present, else the media query.
 */

export const THEME_STORAGE_KEY = "heristiq.theme.v1";

/** What the customer chose. */
export type ThemeChoice = "light" | "dark" | "system";

/** What that choice actually resolves to right now. */
export type ResolvedTheme = "light" | "dark";

export const THEME_CHOICES: readonly ThemeChoice[] = [
  "light",
  "dark",
  "system",
];

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * The browser-chrome colour per theme.
 *
 * These MIRROR --color-bone's two values in globals.css and must be kept
 * equal to them: the meta tag paints the address bar directly above the page,
 * so a shade of difference reads as a seam. (An earlier draft of this file
 * referenced a `--color-void` token that was never declared, and quoted
 * #100f0d for dark; the ground is #12100e — warm near-black, with headroom
 * above pure black so --color-shell can still sit below it.)
 */
export const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: "#faf7f2",
  dark: "#12100e",
};

/**
 * The pre-paint theme script, as a string for a blocking inline <script>.
 *
 * This has to be inline and synchronous in <head>. An external file, `defer`,
 * or a React effect all run after the browser has already painted, which is
 * precisely the flash of light theme this exists to prevent — and on a slow
 * connection that flash is not a flicker, it is a second of white.
 *
 * Written by hand rather than compiled from a function so that what ships is
 * exactly what is read here. Kept tiny for the same reason: it blocks parsing.
 *
 * The try/catch is not defensive padding. `localStorage` THROWS on access —
 * not returns null — in a browser configured to block site data, and in
 * Safari's private mode in some versions. An uncaught throw in a blocking head
 * script stops the parser and takes the page with it, so a customer who has
 * hardened their browser would get a blank shop. Failing to light is correct.
 */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
