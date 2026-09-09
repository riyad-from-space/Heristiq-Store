"use client";

/*
 * The last resort: an error in the root layout itself.
 *
 * This replaces <html> entirely, so it cannot use the site's layout, fonts or
 * components — if the layout is what failed, importing from it would fail
 * again. Hence the inline styles and the hand-written markup: this file has to
 * work when nothing else does.
 *
 * ---------------------------------------------------------------------------
 * Theming it
 *
 * The installed docs are explicit about the limit here
 * (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md,
 * "Global Error"): this file renders its own document and does not include
 * global styles, so an app-level theme class or data-theme attribute does not
 * reach it — and `metadata`/`generateMetadata` are unsupported here, so there
 * is no viewport export and no themeColor either.
 *
 * So the theme comes from a tiny inline stylesheet below: custom properties
 * with a prefers-color-scheme override, plus `color-scheme` so the scrollbar
 * and the button chrome match. That is evaluated by the parser at first paint,
 * needs no build step and no JavaScript, and cannot fail the way an import
 * from the broken layout could.
 *
 * What is NOT possible, and is a deliberate accept: honouring an EXPLICIT
 * in-app override. A customer who chose dark while their OS is light will see
 * this one page in light. There is no server cookie read on a client error
 * boundary, and reading localStorage after mount would be a flash — on the
 * page whose whole job is to fail gracefully. Since the site follows the OS
 * by default and the toggle is an override, this matches for almost everyone.
 */

/*
 * Inline rather than a <style> in a shared file, for the reason above: this
 * file must not import anything that could be what broke.
 */
const THEME_CSS = `
:root{color-scheme:light;--g:#faf7f2;--fg:#17150f;--muted:#6a635a;--faint:#8a8177;--plate:#17150f;--on-plate:#faf7f2}
@media (prefers-color-scheme:dark){:root{color-scheme:dark;--g:#12100e;--fg:#f2eee6;--muted:#a9a196;--faint:#6f685e;--plate:#f2eee6;--on-plate:#12100e}}
`;
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: THEME_CSS }} />
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "var(--g)",
          color: "var(--fg)",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <main>
          <p
            style={{
              fontSize: "0.6875rem",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            Heristiq
          </p>
          <h1
            style={{
              fontFamily: "ui-serif, Georgia, serif",
              fontWeight: 400,
              fontSize: "2rem",
              margin: "1rem 0 0",
            }}
          >
            The site is having a moment
          </h1>
          <p style={{ color: "var(--muted)", marginTop: "0.75rem", fontSize: "0.875rem" }}>
            Something failed before the page could load. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "2rem",
              minHeight: "44px",
              padding: "0 1.5rem",
              background: "var(--plate)",
              color: "var(--on-plate)",
              border: 0,
              borderRadius: "3px",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest && (
            <p style={{ color: "var(--faint)", marginTop: "1.5rem", fontSize: "0.75rem" }}>
              Reference {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
