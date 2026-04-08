import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: path.resolve(__dirname, '../..'),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@bookit/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // usePolling is required for HMR through Docker volume mounts on Mac/Windows
    watch: { usePolling: true, interval: 1000 },
    hmr: { host: 'localhost' },
  },
})
