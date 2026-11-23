import { expect, test, type Page } from '@playwright/test';

const ADMIN = { email: 'admin@procutter.local', senha: 'trocar-esta-senha' };
const COMUM = { email: 'usuario@procutter.local', senha: 'usuario-teste-123' };

async function entrar(page: Page, u: { email: string; senha: string }, destino = '/projetos') {
  await page.goto(destino);
  await page.getByLabel('E-mail').fill(u.email);
  await page.getByLabel('Senha').fill(u.senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test('sem login, qualquer página leva à tela de entrada', async ({ page }) => {
  await page.goto('/projetos');
  await expect(page).toHaveURL(/\/entrar\?de=%2Fprojetos/);
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
});

test('senha errada mostra erro e mantém o e-mail', async ({ page }) => {
  await entrar(page, { ...ADMIN, senha: 'errada' });
  await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible();
  await expect(page.getByLabel('E-mail')).toHaveValue(ADMIN.email);
});

test('admin entra, volta para a página pedida e vê o menu de administração', async ({
  page,
}, info) => {
  await entrar(page, ADMIN, '/clientes');
  await expect(page).toHaveURL(/\/clientes$/);
  await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible();
  if (info.project.name === 'tablet')
    await page.getByRole('button', { name: 'Abrir menu' }).click();
  await expect(page.getByRole('link', { name: 'Configurações' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Usuários' })).toBeVisible();
});

test('usuário comum não vê nem acessa a administração', async ({ page }, info) => {
  await entrar(page, COMUM);
  await expect(page).toHaveURL(/\/projetos$/);
  if (info.project.name === 'tablet')
    await page.getByRole('button', { name: 'Abrir menu' }).click();
  await expect(page.getByRole('link', { name: 'Projetos' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Configurações' })).toHaveCount(0);
  await page.goto('/configuracoes');
  await expect(page).toHaveURL(/\/sem-permissao$/);
  await expect(page.getByRole('heading', { name: 'Sem permissão' })).toBeVisible();
});

test('sair encerra a sessão', async ({ page }, info) => {
  await entrar(page, ADMIN);
  await expect(page).toHaveURL(/\/projetos$/);
  const menu = page.getByRole('button', { name: 'Menu do usuário' }).filter({ visible: true });
  await menu.click();
  await page.getByRole('menuitem', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  await page.goto('/projetos');
  await expect(page).toHaveURL(/\/entrar/);
  void info;
});
