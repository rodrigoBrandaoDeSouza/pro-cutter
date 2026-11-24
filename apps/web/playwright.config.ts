import { config } from 'dotenv';
import { defineConfig, devices } from '@playwright/test';

config({ path: '../../.env', quiet: true });
const PORTA = 3100;
// E2E_PRODUCAO=1 testa a build de produção (next start) em vez do servidor de desenvolvimento
const PRODUCAO = !!process.env.E2E_PRODUCAO;
const DIST = PRODUCAO ? '.next-build' : '.next-e2e';

/** Servidor próprio na porta 3100 com o banco procutter_e2e (recriado no setup), sem tocar nos dados do dev. */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  // E2E_HOST permite testar pelo IP da rede (como na marcenaria), onde o navegador aplica as regras de cookie seguro
  use: {
    baseURL: `http://${process.env.E2E_HOST ?? 'localhost'}:${PORTA}`,
    locale: 'pt-BR',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'tablet', use: { ...devices['iPad (gen 7)'], browserName: 'chromium' } },
  ],
  webServer: {
    command: PRODUCAO ? `npx next start -p ${PORTA}` : `npx next dev -p ${PORTA}`,
    url: `http://localhost:${PORTA}/entrar`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL_E2E!,
      NEXT_DIST_DIR: DIST,
      COOKIE_SEGURO: process.env.COOKIE_SEGURO ?? '',
    },
  },
  globalSetup: './e2e/setup-global.ts',
});
