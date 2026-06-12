/// <reference types="vitest" />
import { getViteConfig } from 'astro/config'

export default getViteConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/*.astro'],
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.astro',
        'src/**/*.d.ts',
        'src/types/**',
        'src/env.d.ts',
        'src/lib/**',       // wrappers de servicios externos (Supabase)
        'src/middleware.ts', // integración — se testea con e2e
      ],
    },
  },
})
