import { defineConfig } from 'vitest/config'
import path from 'node:path'

/**
 * One project per tier, because they resolve modules differently.
 *
 * The domain package is plain TypeScript with relative imports — it needs no
 * aliases, and that is the point: if it ever did, something impure had crept
 * in. The web tier uses Next.js's `@/` alias, which only exists inside that
 * workspace, so it is configured there rather than globally.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'domain',
          include: ['packages/*/src/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        resolve: {
          alias: { '@': path.resolve(import.meta.dirname, 'apps/web') },
        },
        test: {
          name: 'web',
          include: ['apps/web/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
})
