import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import ver from '../version.json'

export default defineConfig({
  base: '/cut-log/',
  plugins: [vue()],
  define: { __PKG_VERSION__: JSON.stringify(ver.version) },
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  optimizeDeps: {
    exclude: ['cutter-wasm'],
  },
  server: {
    fs: { allow: ['..'] },
  },
})
