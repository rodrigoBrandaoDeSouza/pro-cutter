import { config } from 'dotenv';
import { defineConfig, devices } from '@playwright/test';

config({ path: '../../.env', quiet: true });
const PORTA = 3100;

/** Servidor próprio na porta 3100 com o banco procutter_e2e (recriado no setup), sem tocar nos dados do dev. */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORTA}`, locale: 'pt-BR', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'tablet', use: { ...devices['iPad (gen 7)'], browserName: 'chromium' } },
  ],
  webServer: {
    command: `npx next dev -p ${PORTA}`,
    url: `http://localhost:${PORTA}/entrar`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { DATABASE_URL: process.env.DATABASE_URL_E2E!, NEXT_DIST_DIR: '.next-e2e' },
  },
  globalSetup: './e2e/setup-global.ts',
});
