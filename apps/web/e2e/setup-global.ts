import { execSync } from 'node:child_process';

/** Roda com tsx porque o cliente do Prisma é ESM e o Playwright carrega este arquivo como CommonJS. */
export default function setup() {
  execSync('npx tsx e2e/garantir-usuario.ts', { stdio: 'inherit' });
}
