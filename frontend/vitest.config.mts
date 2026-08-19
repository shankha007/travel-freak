import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // `scripts/` is build tooling rather than app code, but the geometry repair
    // in scripts/lib is exactly the sort of thing that must not regress
    // silently — a wrong clip is a stripe across the map nobody notices in a
    // diff.
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'scripts/**/*.{test,spec}.mjs'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      /**
       * `server-only` is a build-time guard, not a runtime one. Its package
       * resolves to a module that throws unless the `react-server` condition is
       * set, which Next sets and a test runner does not — so importing any file
       * marked with it fails before a single assertion runs.
       *
       * Pointed at the package's own empty module rather than a stub of ours, so
       * this stays a resolution detail rather than a fake. Without it the rule is
       * effectively "a server module may be marked server-only or be tested, not
       * both", and the modules most worth testing are the ones that talk to
       * something.
       */
      'server-only': fileURLToPath(new URL('./node_modules/server-only/empty.js', import.meta.url)),
    },
  },
})
