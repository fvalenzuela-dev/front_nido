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
    },
  },
})
