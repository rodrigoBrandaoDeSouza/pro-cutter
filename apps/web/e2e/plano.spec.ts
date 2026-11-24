import { expect, test } from '@playwright/test';
import { COMUM, criarProjeto, entrar, enviarXml, unico, XML_COZINHA } from './ajuda';

test('otimiza a cozinha, navega nas chapas, fixa peça e reotimiza', async ({ page }, info) => {
  test.setTimeout(120_000);
  const id = unico(info);
  await entrar(page, COMUM);
  await criarProjeto(page, `Plano ${id}`);
  await enviarXml(page, 'Escolher arquivo XML', 'cozinha.xml', XML_COZINHA);
  await page.getByRole('dialog').getByRole('button', { name: 'Importar' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.getByRole('tab', { name: /Plano de corte/ }).click();
  await expect(page.getByText('76 peças prontas', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Otimizar corte' }).click();
  await expect(page.getByText('Plano otimizado: 5 chapa(s).')).toBeVisible();

  // resumo e miniaturas: 3 chapas de Branco + 2 de Linho Fendi
  const resumo = page.getByRole('region', { name: 'Resumo do plano' });
  await expect(resumo).toContainText('Chapas5');
  await expect(resumo).toContainText('76 peças');
  const chapas = page.getByRole('region', { name: 'Chapas' }).getByRole('button');
  await expect(chapas).toHaveCount(5);
  await expect(chapas.nth(3)).toHaveAccessibleName(/Chapa 4: MDF Fibraplac Linho Fendi 15mm/);

  // abre a chapa 4, seleciona uma peça e fixa
  await chapas.nth(3).click();
  const detalhe = page.getByRole('region', { name: 'Chapa 4 em detalhe' });
  await expect(detalhe).toBeVisible();
  const primeiraPeca = detalhe.getByRole('button', { name: /^Peça \d+:/ }).first();
  const nomePeca = (await primeiraPeca.getAttribute('aria-label'))!;
  await primeiraPeca.click();
  await expect(detalhe.getByText(/Peça nº \d+/)).toBeVisible();
  await detalhe.getByRole('button', { name: 'Fixar nesta chapa' }).click();
  await expect(page.getByText('1 peça(s) fixada(s)')).toBeVisible();

  // sequência de cortes
  await detalhe.getByRole('tab', { name: 'Sequência de cortes' }).click();
  await expect(detalhe.getByText(/Corte 1 de \d+/)).toBeVisible();
  await detalhe.getByRole('button', { name: 'Próximo corte' }).click();
  await expect(detalhe.getByText(/Corte 2 de \d+/)).toBeVisible();

  // muda uma peça: plano fica desatualizado
  await page.getByRole('tab', { name: /Peças/ }).click();
  await page.getByRole('button', { name: 'Peça avulsa' }).click();
  const pc = page.getByRole('dialog', { name: 'Peça avulsa' });
  await pc.getByLabel('Nome', { exact: true }).fill('Tampo extra');
  await pc.getByLabel('Comprimento', { exact: true }).fill('900');
  await pc.getByLabel('Largura', { exact: true }).fill('400');
  await pc.getByRole('button', { name: 'Salvar' }).click();
  await expect(pc).toBeHidden();
  await page.getByRole('tab', { name: /Plano de corte/ }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'As peças mudaram' })).toBeVisible();

  // reotimiza mantendo a peça fixada na chapa 4
  await page.getByRole('button', { name: 'Otimizar de novo' }).click();
  await expect(page.getByText(/Plano otimizado/)).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'As peças mudaram' })).toHaveCount(0);
  await expect(page.getByText('Versão 2', { exact: false })).toBeVisible();
  await page.getByRole('region', { name: 'Chapas' }).getByRole('button').nth(3).click();
  // o rótulo é 'Peça N: nome C × L'; o número pode mudar, o resto não
  const semNumero = nomePeca.replace(/^Peça \d+/, '');
  await expect(
    page
      .getByRole('region', { name: 'Chapa 4 em detalhe' })
      .getByRole('button', { name: semNumero })
      .first(),
  ).toBeVisible();
});
