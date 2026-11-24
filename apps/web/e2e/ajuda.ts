import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

export const XML_COZINHA = readFileSync(
  join(__dirname, '../../../.doc/models/Everaldo cozinha.xml'),
);

/** Cria projeto com cliente novo e abre a página dele. */
export async function criarProjeto(page: Page, nome: string) {
  await page.goto('/projetos');
  await page.getByRole('button', { name: 'Novo projeto' }).first().click();
  const dlg = page.getByRole('dialog', { name: 'Novo projeto' });
  await dlg.getByLabel('Nome do projeto').fill(nome);
  await dlg.getByRole('button', { name: 'Cadastrar cliente novo' }).click();
  const c = page.getByRole('dialog', { name: 'Novo cliente' });
  await c.getByLabel('Nome').fill(`Cliente ${nome}`);
  await c.getByRole('button', { name: 'Cadastrar' }).click();
  await expect(c).toBeHidden();
  await dlg.getByRole('button', { name: 'Criar projeto' }).click();
  await expect(page.getByRole('heading', { name: nome })).toBeVisible();
}

/** Envia um XML pelo seletor indicado e espera o diálogo de confirmação. */
export async function enviarXml(page: Page, rotulo: string, nomeArquivo: string, conteudo: Buffer) {
  await page
    .getByLabel(rotulo)
    .setInputFiles({ name: nomeArquivo, mimeType: 'text/xml', buffer: conteudo });
  await expect(page.getByRole('dialog')).toBeVisible();
}
