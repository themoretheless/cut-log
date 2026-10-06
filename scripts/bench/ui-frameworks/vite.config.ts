import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

const benchmarkRoot = fileURLToPath(new URL('.', import.meta.url))
const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url))

export default defineConfig({
  root: benchmarkRoot,
  plugins: [vue(), svelte()],
  resolve: {
    alias: {
      '@cutlog': fileURLToPath(new URL('../../../frontend/src', import.meta.url)),
      '@': fileURLToPath(new URL('../../../frontend/src', import.meta.url)),
    },
    dedupe: ['svelte', 'vue'],
  },
  server: {
    fs: {
      allow: [repositoryRoot],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    minify: 'oxc',
    manifest: true,
    rollupOptions: {
      input: {
        'vue-layout': fileURLToPath(new URL('./vue-layout.html', import.meta.url)),
        'svelte-layout': fileURLToPath(new URL('./svelte-layout.html', import.meta.url)),
        'retained-layout': fileURLToPath(new URL('./retained-layout.html', import.meta.url)),
        'vue-skadis': fileURLToPath(new URL('./vue-skadis.html', import.meta.url)),
        'svelte-skadis': fileURLToPath(new URL('./svelte-skadis.html', import.meta.url)),
        'retained-skadis': fileURLToPath(new URL('./retained-skadis.html', import.meta.url)),
      },
    },
  },
})
