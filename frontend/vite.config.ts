import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  base: '/plywood-cutter/',
  plugins: [vue()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  optimizeDeps: {
    exclude: ['cutter-wasm'],
  },
  server: {
    fs: { allow: ['..'] },
  },
})
