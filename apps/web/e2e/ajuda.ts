import { expect, type Page, type TestInfo } from '@playwright/test';

export const ADMIN = { email: 'admin@procutter.local', senha: 'trocar-esta-senha' };
export const COMUM = { email: 'usuario@procutter.local', senha: 'usuario-teste-123' };

export async function entrar(
  page: Page,
  u: { email: string; senha: string },
  destino = '/projetos',
) {
  await page.goto(destino);
  await page.getByLabel('E-mail').fill(u.email);
  await page.getByLabel('Senha').fill(u.senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).not.toHaveURL(/\/entrar/);
}

/** Sufixo único por projeto de teste (desktop/tablet) e execução, para não colidir dados. */
export function unico(info: TestInfo): string {
  return `${info.project.name}-${Date.now().toString(36)}`;
}
