import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
    // supabase/ holds Edge Function tests, plain Node scripts run on their own
    // (see supabase/tests/README.md), not website tests.
    exclude: [...configDefaults.exclude, 'supabase/**'],
  },
})
