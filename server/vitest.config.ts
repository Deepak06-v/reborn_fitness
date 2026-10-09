import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 60000,
    hookTimeout: 180000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
})
