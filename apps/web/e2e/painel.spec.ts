import { expect, test } from '@playwright/test';
import { ADMIN, COMUM, criarProjeto, entrar, enviarXml, unico, XML_COZINHA } from './ajuda';

test('projeto em corte aparece no painel; admin ajusta a referência', async ({ page }, info) => {
  test.setTimeout(120_000);
  const id = unico(info);
  await entrar(page, ADMIN);
  await criarProjeto(page, `Painel ${id}`);
  await enviarXml(page, 'Escolher arquivo XML', 'cozinha.xml', XML_COZINHA);
  await page.getByRole('dialog').getByRole('button', { name: 'Importar' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('tab', { name: /Plano de corte/ }).click();
  await page.getByRole('button', { name: 'Otimizar corte' }).click();
  await expect(page.getByText('Plano otimizado: 5 chapa(s).')).toBeVisible();

  // só conta no painel depois de ir para o corte
  await page.getByRole('button', { name: 'Status: Orçamento' }).click();
  await page.getByRole('menuitemradio', { name: 'Em corte' }).click();
  await expect(page.getByRole('button', { name: 'Status: Em corte' })).toBeVisible();

  await page.goto('/painel');
  await expect(page.getByRole('heading', { name: 'Painel', exact: true })).toBeVisible();
  const indicadores = page.getByRole('region', { name: 'Indicadores' });
  await expect(indicadores).toContainText('Chapas cortadas');
  await expect(indicadores).toContainText(/Aproveitamento\s*\d/);
  await expect(page.getByRole('region', { name: 'Por material' })).toContainText(
    'MDF Fibraplac Linho Fendi 15mm',
  );
  await expect(page.getByRole('figure', { name: 'Aproveitamento por mês' })).toBeVisible();

  // período muda pela URL
  await page.getByRole('link', { name: '3 meses' }).click();
  await expect(page).toHaveURL(/meses=3/);
  await expect(page.getByText('últimos 3 meses')).toBeVisible();

  // referência: valida e salva
  const ref = page.getByLabel('Aproveitamento de referência (%)');
  await ref.fill('20');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Mínimo 30%')).toBeVisible();
  await ref.fill('75');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Referência salva.')).toBeVisible();
  await expect(page.getByText('referência 75%').first()).toBeVisible();
  // devolve o padrão para não afetar outros testes
  await ref.fill('70');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('referência 70%').first()).toBeVisible();
});

test('usuário comum não acessa o painel', async ({ page }) => {
  await entrar(page, COMUM);
  await expect(page.getByRole('link', { name: 'Painel', exact: true })).toHaveCount(0);
  await page.goto('/painel');
  await expect(page).toHaveURL(/sem-permissao/);
});
