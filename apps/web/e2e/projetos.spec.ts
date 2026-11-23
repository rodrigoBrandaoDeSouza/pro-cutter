import { expect, test } from '@playwright/test';
import { ADMIN, COMUM, entrar, unico } from './ajuda';

test('cria projeto com cliente novo, muda status, filtra e edita', async ({ page }, info) => {
  const id = unico(info);
  await entrar(page, COMUM, '/projetos');

  await page.getByRole('button', { name: 'Novo projeto' }).first().click();
  const dlg = page.getByRole('dialog', { name: 'Novo projeto' });
  await dlg.getByLabel('Nome do projeto').fill(`Cozinha ${id}`);
  await dlg.getByRole('button', { name: 'Criar projeto' }).click();
  await expect(dlg.getByText('Escolha o cliente').last()).toBeVisible();

  // cadastra o cliente sem sair do diálogo
  await dlg.getByRole('button', { name: 'Cadastrar cliente novo' }).click();
  const dlgCliente = page.getByRole('dialog', { name: 'Novo cliente' });
  await dlgCliente.getByLabel('Nome').fill(`Everaldo ${id}`);
  await dlgCliente.getByRole('button', { name: 'Cadastrar' }).click();
  await expect(dlgCliente).toBeHidden();
  await expect(dlg.getByLabel('Cliente', { exact: true })).toHaveValue(/.+/);
  await dlg.getByRole('button', { name: 'Criar projeto' }).click();

  await expect(page).toHaveURL(/\/projetos\/[a-z0-9]+$/);
  await expect(page.getByRole('heading', { name: `Cozinha ${id}` })).toBeVisible();
  await expect(page.getByText(`Everaldo ${id}`, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Status: Orçamento' }).click();
  await page.getByRole('menuitemradio', { name: 'Aprovado' }).click();
  await expect(page.getByRole('button', { name: 'Status: Aprovado' })).toBeVisible();
  await page.getByRole('tab', { name: 'Histórico' }).click();
  const hist = page.getByRole('list', { name: 'Histórico de status' });
  await expect(hist.getByRole('listitem')).toHaveCount(2);
  await expect(hist.getByRole('listitem').first()).toContainText('Aprovado');

  await page.getByRole('button', { name: 'Mais ações do projeto' }).click();
  await page.getByRole('menuitem', { name: 'Editar dados' }).click();
  await page.getByLabel('Nome do projeto').fill(`Cozinha planejada ${id}`);
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('heading', { name: `Cozinha planejada ${id}` })).toBeVisible();

  // usuário comum não exclui projeto
  await page.getByRole('button', { name: 'Mais ações do projeto' }).click();
  await expect(page.getByRole('menuitem', { name: 'Excluir projeto' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  await page.goto('/projetos?status=APROVADO');
  await page.getByLabel('Buscar projetos').fill(id);
  await expect(page).toHaveURL(new RegExp(`status=APROVADO.*q=${id}|q=${id}.*status=APROVADO`));
  await expect(
    page.getByRole('link', { name: new RegExp(`Cozinha planejada ${id}`) }),
  ).toBeVisible();
  await page.getByRole('link', { name: /^Orçamento/ }).click();
  await expect(page.getByRole('link', { name: new RegExp(`Cozinha planejada ${id}`) })).toHaveCount(
    0,
  );
});

test('admin exclui projeto', async ({ page }, info) => {
  const id = unico(info);
  await entrar(page, ADMIN, '/clientes');
  await page.getByRole('button', { name: 'Novo cliente' }).click();
  await page.getByRole('dialog').getByLabel('Nome').fill(`Cliente ${id}`);
  await page.getByRole('dialog').getByRole('button', { name: 'Cadastrar' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.goto('/projetos');
  await page.getByRole('button', { name: 'Novo projeto' }).first().click();
  const dlg = page.getByRole('dialog', { name: 'Novo projeto' });
  await dlg.getByLabel('Nome do projeto').fill(`Apagar ${id}`);
  await dlg.getByLabel('Cliente', { exact: true }).selectOption({ label: `Cliente ${id}` });
  await dlg.getByRole('button', { name: 'Criar projeto' }).click();
  await expect(page.getByRole('heading', { name: `Apagar ${id}` })).toBeVisible();

  await page.getByRole('button', { name: 'Mais ações do projeto' }).click();
  await page.getByRole('menuitem', { name: 'Excluir projeto' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Excluir projeto' }).click();
  await expect(page).toHaveURL(/\/projetos$/);
  await expect(page.getByText(`Apagar ${id}`)).toHaveCount(0);
});
