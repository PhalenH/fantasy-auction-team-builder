import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // '' prefix loads every var in .env, not just VITE_-prefixed ones. Nothing
  // here is exposed to the client bundle — these values are only used by the
  // dev server proxy and by the server test project below.
  const env = loadEnv(mode, process.cwd(), '')
  const apiPort = env.API_PORT || '3001'

  return {
    plugins: [react(), tailwindcss()],

    server: {
      // Forward /api to the Express server in dev so the browser sees one
      // origin. This is why there's no cors dependency: same-origin requests
      // need no CORS headers and trigger no preflight.
      proxy: {
        '/api': { target: `http://localhost:${apiPort}` },
      },
    },

    test: {
      // Two projects because the suites need different environments: React
      // components need jsdom plus the testing-library setup file, while the
      // Express/pg tests need node (the setup file's DOM cleanup is
      // meaningless — and breakable — outside a browser environment).
      projects: [
        {
          extends: true,
          test: {
            name: 'web',
            environment: 'jsdom',
            setupFiles: ['./src/vitest.setup.ts'],
            include: ['src/**/*.test.{ts,tsx}'],
          },
        },
        {
          extends: true,
          test: {
            name: 'server',
            environment: 'node',
            include: ['server/**/*.test.ts'],
            // Server tests run against the real local database, so they need
            // the same connection string the runtime uses. Vitest doesn't
            // read .env into process.env on its own.
            env: { DATABASE_URL: env.DATABASE_URL, API_PORT: apiPort },
          },
        },
      ],
    },
  }
})
