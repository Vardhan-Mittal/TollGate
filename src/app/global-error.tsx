"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

// Replaces the root layout when it fails, so it brings its own document and
// inline styles (globals.css and the fonts are not loaded here).
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "0 16px",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          background: "light-dark(#ffffff, #0a0a0a)",
          color: "light-dark(#171717, #ededed)",
          colorScheme: "light dark",
        }}
      >
        <title>Tollgate: something went wrong</title>
        <main style={{ maxWidth: 520 }}>
          <p style={{ color: "#059669", fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase" }}>Tollgate</p>
          <h1 style={{ margin: "12px 0 0", fontSize: 36, fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.035em" }}>Something went wrong.</h1>
          <p style={{ marginTop: 16, color: "light-dark(#52525b, #a1a1aa)", lineHeight: 1.6 }}>
            The site couldn&apos;t load. Trying again normally fixes it.
            {error.digest && <span style={{ display: "block", marginTop: 8, fontSize: 12 }}>Reference: {error.digest}</span>}
          </p>
          <div style={{ marginTop: 32, display: "flex", flexWrap: "wrap", gap: 12 }}>
            <button
              type="button"
              onClick={() => retry()}
              style={{
                border: 0,
                borderRadius: 999,
                padding: "10px 20px",
                font: "inherit",
                fontSize: 14,
                fontWeight: 500,
                color: "light-dark(#ffffff, #18181b)",
                background: "light-dark(#18181b, #fafafa)",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            {/* A plain link: a full page load is the most reliable reset when the layout itself failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" style={{ borderRadius: 999, padding: "10px 20px", fontSize: 14, fontWeight: 500, color: "inherit", border: "1px solid light-dark(#e4e4e7, rgb(255 255 255 / 0.1))", textDecoration: "none" }}>
              Back to home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
