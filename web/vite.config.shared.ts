import path from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Shared Vite config factory for consumer and biz apps.
 * Each app passes its own __dirname and dev server port.
 */
export function createViteConfig(dirname: string, port: number) {
  return defineConfig({
    // Tailwind is excluded during tests — it scans all source files at startup
    // and causes excessive memory usage without providing any test value.
    plugins: [react(), ...(process.env.VITEST ? [] : [tailwindcss()])],
    envDir: path.resolve(dirname, '../..'),
    resolve: {
      alias: {
        '@': path.resolve(dirname, './src'),
        '@bookit/shared': path.resolve(dirname, '../shared/src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port,
      strictPort: true,
      // usePolling is required for HMR through Docker volume mounts on Mac/Windows
      watch: { usePolling: true, interval: 1000 },
      hmr: { host: 'localhost' },
    },
    test: {
      globals: true,
      environment: 'happy-dom',
      setupFiles: ['./src/test/setup.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov', 'json-summary', 'json'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/test/**', 'src/mocks/**'],
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Rolldown (Vite 8) requires manualChunks as a function, not an object.
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return
            if (id.includes('react-dom') || id.includes('react-router-dom') || id.includes('/react/'))
              return 'react-vendor'
            if (id.includes('@tanstack/react-query'))
              return 'query-vendor'
            if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('/zod/'))
              return 'form-vendor'
          },
        },
      },
    },
  })
}
