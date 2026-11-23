import { execSync } from 'node:child_process';

/**
 * Recria o banco procutter_e2e (migrações + seed + usuário comum). Roda com tsx porque o cliente do
 * Prisma é ESM e o Playwright carrega este arquivo como CommonJS.
 */
export default function setup() {
  execSync('npx tsx e2e/preparar-banco.ts', { stdio: 'inherit' });
}
