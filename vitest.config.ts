import { getViteConfig } from 'astro/config'
import type { UserConfig as ViteUserConfig } from 'vite'

// getViteConfig accepts Vite's UserConfig; Vitest augments the type with `test`
// via its own module declaration. We cast to allow the `test` block.
export default getViteConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/*.astro'],
  },
} as ViteUserConfig)
