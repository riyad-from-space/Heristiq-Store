"use client";

/*
 * The last resort: an error in the root layout itself.
 *
 * This replaces <html> entirely, so it cannot use the site's layout, fonts or
 * components — if the layout is what failed, importing from it would fail
 * again. Hence the inline styles and the hand-written markup: this file has to
 * work when nothing else does.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#faf7f2",
          color: "#17150f",
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
              color: "#6a635a",
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
          <p style={{ color: "#6a635a", marginTop: "0.75rem", fontSize: "0.875rem" }}>
            Something failed before the page could load. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "2rem",
              minHeight: "44px",
              padding: "0 1.5rem",
              background: "#17150f",
              color: "#faf7f2",
              border: 0,
              borderRadius: "3px",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest && (
            <p style={{ color: "#a29a8e", marginTop: "1.5rem", fontSize: "0.75rem" }}>
              Reference {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
