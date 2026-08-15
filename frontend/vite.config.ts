import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve } from 'path'
import ver from '../version.json'

export default defineConfig({
  base: '/cut-log/',
  plugins: [svelte()],
  define: { __PKG_VERSION__: JSON.stringify(ver.version) },
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
    // Component tests need the browser build of Svelte, not the SSR one.
    // Only applied under Vitest so dev/build resolution is untouched.
    ...(process.env.VITEST ? { conditions: ['browser'] } : {}),
  },
  // The optimizer worker code-splits (dynamic wasm import), which rules out the
  // default iife worker format.
  worker: { format: 'es' },
  optimizeDeps: {
    exclude: ['cutter-wasm'],
  },
  server: {
    fs: { allow: ['..'] },
  },
  test: {
    // Node by default, matching the Vue suite. Runes, however, need the client
    // compiler: under the server generator `$effect.root` silently becomes a
    // no-op and a composable comes back undefined instead of failing loudly.
    // Every `*.svelte.test.ts` therefore gets a DOM environment automatically,
    // so a forgotten docblock cannot turn a test file into a vacuous pass.
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.svelte.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'runes',
          include: ['src/**/*.svelte.test.ts'],
          environment: 'happy-dom',
        },
      },
    ],
    typecheck: {
      include: ['src/**/*.test.ts'],
    },
  },
})
