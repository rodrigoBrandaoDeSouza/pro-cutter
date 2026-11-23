import { expect, test } from '@playwright/test';
import { ADMIN, entrar, unico } from './ajuda';

test('admin cria usuário, que entra; depois desativa e a pessoa perde o acesso', async ({
  page,
  browser,
}, info) => {
  const id = unico(info);
  const email = `marceneiro-${id}@teste.com`;
  await entrar(page, ADMIN, '/usuarios');

  await page.getByRole('button', { name: 'Novo usuário' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Nome').fill('J');
  await dlg.getByLabel('E-mail').fill(email);
  await dlg.getByLabel('Senha').fill('123');
  await dlg.getByRole('button', { name: 'Criar usuário' }).click();
  await expect(dlg.getByText('Informe o nome')).toBeVisible();
  await expect(dlg.getByText('pelo menos 8 caracteres')).toBeVisible();

  await dlg.getByLabel('Nome').fill(`João ${id}`);
  await dlg.getByLabel('Senha').fill('senha-do-joao');
  await dlg.getByRole('button', { name: 'Criar usuário' }).click();
  await expect(dlg).toBeHidden();
  await expect(page.getByRole('cell', { name: `João ${id}`, exact: true })).toBeVisible();

  // a pessoa nova entra em outra sessão
  const outro = await browser.newContext();
  const p2 = await outro.newPage();
  await entrar(p2, { email, senha: 'senha-do-joao' });
  await expect(p2.getByRole('heading', { name: 'Projetos' })).toBeVisible();

  // admin desativa: a sessão da pessoa cai
  await page.getByRole('button', { name: `Editar João ${id}` }).click();
  await page.getByLabel('Acesso ativo').uncheck();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(
    page.getByRole('row', { name: new RegExp(`João ${id}`) }).getByText('Desativado'),
  ).toBeVisible();
  await p2.reload();
  await expect(p2).toHaveURL(/\/entrar/);
  await outro.close();
});

test('e-mail repetido e auto-rebaixamento são recusados', async ({ page }) => {
  await entrar(page, ADMIN, '/usuarios');
  await page.getByRole('button', { name: 'Novo usuário' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Nome').fill('Outro Admin');
  await dlg.getByLabel('E-mail').fill(ADMIN.email);
  await dlg.getByLabel('Senha').fill('qualquer-senha');
  await dlg.getByRole('button', { name: 'Criar usuário' }).click();
  await expect(dlg.getByText('E-mail já cadastrado')).toBeVisible();
  await dlg.getByRole('button', { name: 'Cancelar' }).click();

  await page.getByRole('button', { name: 'Editar Administrador' }).click();
  await page.getByLabel('Permissão').selectOption('USUARIO');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('não pode tirar seu próprio acesso')).toBeVisible();
});
