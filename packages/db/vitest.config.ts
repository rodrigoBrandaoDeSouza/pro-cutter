import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'db',
    globalSetup: ['./src/teste/setup-global.ts'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 120000,
  },
});
