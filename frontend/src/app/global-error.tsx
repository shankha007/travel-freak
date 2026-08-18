'use client'

/**
 * The last boundary: a failure in the root layout itself.
 *
 * This *replaces* the root layout rather than rendering inside it, which is why
 * it carries its own `<html>` and `<body>`. Everything the app normally
 * provides is gone at this point — the theme provider, the fonts, and quite
 * possibly the stylesheet, since a layout that threw may never have got as far
 * as loading it.
 *
 * So the styling is inline and deliberately primitive. A Tailwind class here
 * would be a bet that the CSS which the broken layout was responsible for
 * pulling in arrived anyway; inline styles need nothing but the browser. The
 * colours are the two that work on either theme without asking which one is on.
 *
 * Nearly nothing reaches this. `(app)/error.tsx` and `app/error.tsx` catch page
 * failures with the shell intact, and this is only for when the shell is what
 * broke — which is exactly when the app cannot be trusted to render anything
 * clever.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          background: '#fff',
          color: '#111',
        }}
      >
        <main style={{ maxWidth: '28rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.25rem', margin: '0 0 0.5rem' }}>Something went wrong</h1>

          <p style={{ margin: '0 0 1.25rem', color: '#555', lineHeight: 1.5 }}>
            The app failed to start. Trying again usually works — nothing you have recorded is
            affected.
          </p>

          <button
            type="button"
            onClick={() => retry()}
            style={{
              font: 'inherit',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid #111',
              background: '#111',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>

          {/* The digest and nothing else — see `error-state.tsx` for why the
              message itself never reaches the screen. */}
          {error.digest && (
            <p style={{ marginTop: '1.25rem', fontSize: '0.75rem', color: '#777' }}>
              Reference <code>{error.digest}</code>
            </p>
          )}
        </main>
      </body>
    </html>
  )
}
