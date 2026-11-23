import { expect, test } from '@playwright/test';
import { COMUM, entrar, unico } from './ajuda';

test('usuário comum cadastra, busca, edita e exclui cliente', async ({ page }, info) => {
  const id = unico(info);
  await entrar(page, COMUM, '/clientes');

  await page.getByRole('button', { name: 'Novo cliente' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Nome').fill(`Everaldo ${id}`);
  await dlg.getByLabel('Telefone').pressSequentially('45999998888');
  await expect(dlg.getByLabel('Telefone')).toHaveValue('(45) 99999-8888');
  await dlg.getByRole('button', { name: 'Cadastrar' }).click();
  await expect(dlg).toBeHidden();
  await expect(page.getByRole('cell', { name: `Everaldo ${id}`, exact: true })).toBeVisible();

  await page.getByLabel('Buscar clientes').fill(id);
  await expect(page).toHaveURL(new RegExp(`q=${id}`));
  await expect(page.getByRole('row')).toHaveCount(2); // cabeçalho + 1

  await page.getByRole('button', { name: `Editar Everaldo ${id}` }).click();
  await page.getByRole('dialog').getByLabel('Nome').fill(`Everaldo Gobbi ${id}`);
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('cell', { name: `Everaldo Gobbi ${id}`, exact: true })).toBeVisible();

  await page.getByRole('button', { name: `Excluir Everaldo Gobbi ${id}` }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Excluir' }).click();
  await expect(page.getByRole('cell', { name: `Everaldo Gobbi ${id}`, exact: true })).toHaveCount(
    0,
  );
});
