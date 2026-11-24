import { expect, test } from '@playwright/test';
import { ADMIN, entrar, unico } from './ajuda';

test.beforeEach(async ({ page }) => {
  await entrar(page, ADMIN, '/configuracoes');
});

test('materiais: cadastra com chave do Promob e recusa chave repetida', async ({ page }, info) => {
  const id = unico(info);
  await expect(page.getByRole('row', { name: /MDF Branco 15mm/ })).toBeVisible();

  await page.getByRole('button', { name: 'Novo material' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Descrição').fill(`MDF Freijó ${id}`);
  await dlg.getByLabel('Espessura').fill('18');
  await dlg.getByLabel('Tem veio').check();
  await dlg.getByLabel('Chaves do Promob').fill('Branco|15');
  await dlg.getByRole('button', { name: 'Salvar' }).click();
  await expect(dlg.getByText('Chave repetida em outro material')).toBeVisible();

  await dlg.getByLabel('Chaves do Promob').fill(`Freijo ${id}|18`);
  await dlg.getByRole('button', { name: 'Salvar' }).click();
  await expect(dlg).toBeHidden();
  const linha = page.getByRole('row', { name: new RegExp(`MDF Freijó ${id}`) });
  await expect(linha).toContainText('Veio');
  await expect(linha).toContainText('2.750 × 1.830');
});

test('máquina: salva serra com vírgula e recusa valor inválido', async ({ page }) => {
  await page.getByRole('tab', { name: 'Máquina' }).click();
  await expect(page).toHaveURL(/aba=maquina/);
  await page.getByLabel('Espessura da serra (mm)').fill('4,4');
  await page.getByRole('button', { name: 'Salvar máquina' }).click();
  await expect(page.getByText('Máquina atualizada.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Espessura da serra (mm)')).toHaveValue('4,4');

  await page.getByLabel('Espessura da serra (mm)').fill('20');
  await page.getByRole('button', { name: 'Salvar máquina' }).click();
  await expect(page.getByText('Serra: máximo 10 mm')).toBeVisible();
});

test('regras: muda valor; não deixa remover parâmetro usado em fórmula', async ({ page }) => {
  await page.goto('/configuracoes?aba=regras');
  await page.getByLabel('Valor de Folga entre portas').fill('2,5');
  await page.getByRole('button', { name: 'Salvar regras' }).click();
  await expect(page.getByText('Regras salvas')).toBeVisible();

  await page.getByRole('button', { name: 'Remover Folga entre portas' }).click();
  await page.getByRole('button', { name: 'Salvar regras' }).click();
  await expect(page.getByText(/quebra fórmulas/)).toBeVisible();

  // devolve o valor original para não afetar os outros testes
  await page.reload();
  await page.getByLabel('Valor de Folga entre portas').fill('3');
  await page.getByRole('button', { name: 'Salvar regras' }).click();
  await expect(page.getByText('Regras salvas')).toBeVisible();
});

test('fórmulas: valida enquanto digita, mostra prévia e salva', async ({ page }, info) => {
  const nome = `Gaveteiro ${unico(info)}`;
  await page.goto('/configuracoes?aba=formulas');
  await expect(page.getByRole('button', { name: 'Balcão' })).toHaveAttribute(
    'aria-current',
    'true',
  );

  const previa = page.getByRole('list', { name: 'Peças da prévia' });
  await expect(previa).toContainText('2× Porta');
  await page.getByLabel('Prévia nPortas').fill('1');
  await expect(previa).toContainText('1× Porta');

  const largura = page.locator('#p0-largura');
  const original = await largura.inputValue();
  await largura.fill('L - folgaInexistente');
  await expect(page.locator('#p0-largura-erro')).toHaveText(
    'variável desconhecida: folgaInexistente',
  );
  await expect(page.getByRole('button', { name: 'Salvar fórmulas' })).toBeDisabled();

  await largura.fill(original);
  // resultado ao vivo no módulo de exemplo (L 800, 1 porta, folgas 2)
  await expect(page.getByText('= 796 mm')).toBeVisible();

  // clicar na variável insere no cursor da última fórmula
  const quantidade = page.locator('#p0-quantidade');
  await quantidade.fill('');
  await quantidade.focus();
  await page.getByRole('button', { name: /^nPortas Número de portas/ }).click();
  await expect(quantidade).toHaveValue('nPortas');
  await expect(quantidade).toBeFocused();

  // o atalho leva às folgas
  await page.getByRole('button', { name: 'Alterar valores' }).click();
  await expect(page.getByLabel('Valor de Folga entre portas')).toBeVisible();
  await page.getByRole('tab', { name: 'Fórmulas' }).click();

  await page.getByRole('button', { name: 'Novo tipo' }).click();
  await page.getByLabel('Nome do tipo').fill(nome);
  await page.getByRole('button', { name: 'Salvar fórmulas' }).click();
  await expect(page.getByText('Fórmulas salvas')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: nome })).toBeVisible();
});

test('importação e etiqueta: salvam e voltam iguais', async ({ page }) => {
  await page.goto('/configuracoes?aba=importacao');
  await page.getByLabel('Origem de fundo').selectOption('pro-cutter');
  await page.getByRole('button', { name: 'Salvar importação' }).click();
  await expect(page.getByText('Configuração de importação salva.')).toBeVisible();

  await page.getByLabel('Borda do lado 1').selectOption({ label: 'Comprimento superior' });
  await page.getByRole('button', { name: 'Salvar importação' }).click();
  await expect(
    page.getByText('Cada lado do Promob deve ir para uma borda diferente'),
  ).toBeVisible();

  await page.getByLabel('Altura (mm)').fill('40');
  await page.getByRole('button', { name: 'Salvar etiqueta' }).click();
  await expect(page.getByText('Tamanho da etiqueta salvo.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Origem de fundo')).toHaveValue('pro-cutter');
  await expect(page.getByLabel('Altura (mm)')).toHaveValue('40');
});
