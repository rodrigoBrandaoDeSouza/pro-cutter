import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { COMUM, entrar, unico } from './ajuda';

const XML = readFileSync(join(__dirname, '../../../.doc/models/Everaldo cozinha.xml'));

async function criarProjeto(page: Page, nome: string) {
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

async function importar(page: Page, rotulo: string, nomeArquivo: string, conteudo: Buffer) {
  await page
    .getByLabel(rotulo)
    .setInputFiles({ name: nomeArquivo, mimeType: 'text/xml', buffer: conteudo });
  await expect(page.getByRole('dialog')).toBeVisible();
}

test('importa a cozinha, cria módulo, ajusta regra, peça avulsa e reimporta', async ({
  page,
}, info) => {
  test.setTimeout(90_000);
  const id = unico(info);
  await entrar(page, COMUM);
  await criarProjeto(page, `Cozinha ${id}`);

  // 1) importação sem pendências (materiais do seed já têm as chaves do Promob)
  await importar(page, 'Escolher arquivo XML', 'Everaldo cozinha.xml', XML);
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByText('Linhas no XML')).toBeVisible();
  await expect(dlg).toContainText('76');
  await expect(dlg.getByText('Materiais que o pro-cutter ainda não conhece')).toHaveCount(0);
  await dlg.getByLabel('Nome do ambiente').fill('Cozinha');
  await dlg.getByRole('button', { name: 'Importar' }).click();
  await expect(dlg).toBeHidden();
  const amb = page.getByRole('region', { name: 'Ambiente Cozinha' });
  await expect(amb).toContainText('76 do Promob · 0 geradas · 0 avulsas');

  // 2) módulo com portas e fundo (prévia ao vivo)
  await amb.getByRole('button', { name: 'Novo módulo' }).click();
  const mod = page.getByRole('dialog', { name: 'Novo módulo' });
  await mod.getByLabel('Nome').fill('Balcão pia');
  await mod.getByLabel('Largura').fill('800');
  await mod.getByLabel('Altura').fill('720');
  await mod.getByLabel('Profundidade').fill('550');
  const previa = mod.getByRole('region', { name: 'Prévia das peças do módulo' });
  await expect(previa).toContainText('2× Porta');
  await expect(previa).toContainText('714 × 396,5');
  await expect(previa).toContainText('1× Fundo');
  await mod.getByRole('button', { name: 'Criar módulo' }).click();
  await expect(mod).toBeHidden();
  await expect(amb).toContainText('76 do Promob · 3 geradas · 0 avulsas');
  await expect(amb.getByText('2× Porta 714×396,5')).toBeVisible();

  // 3) regra do projeto recalcula as portas
  await page.getByRole('tab', { name: 'Regras' }).click();
  await page.getByLabel('Valor de Folga da porta nas laterais').fill('3');
  await page.getByRole('button', { name: 'Salvar e recalcular' }).click();
  await expect(page.getByText('Regras do projeto salvas e peças recalculadas.')).toBeVisible();
  await page.getByRole('tab', { name: 'Ambientes' }).click();
  await expect(amb.getByText('2× Porta 714×395,5')).toBeVisible();

  // 4) peça avulsa
  await page.getByRole('tab', { name: /Peças/ }).click();
  // 47 do XML + 2 portas geradas em Branco 15; fundo vai para o Branco 6
  const resumo = page.getByRole('list', { name: 'Resumo por material' });
  await expect(resumo).toContainText('MDF Branco 15mm49peças');
  await expect(resumo).toContainText('MDF Branco 6mm1peças');
  await expect(resumo).toContainText('Linho Fendi 15mm29peças');
  await page.getByRole('button', { name: 'Peça avulsa' }).click();
  const pc = page.getByRole('dialog', { name: 'Peça avulsa' });
  await pc.getByLabel('Nome', { exact: true }).fill('Prateleira extra');
  await pc.getByLabel('Comprimento', { exact: true }).fill('700');
  await pc.getByLabel('Largura', { exact: true }).fill('300');
  await pc.getByLabel('Quantidade').fill('2');
  await pc.getByRole('button', { name: 'Salvar' }).click();
  await expect(pc).toBeHidden();
  await expect(page.getByRole('row', { name: /Prateleira extra/ })).toContainText('700 × 300');
  await expect(page.getByRole('tab', { name: /Peças/ })).toContainText('81');

  // 5) reimportar mantém módulo e avulsas, troca só as do XML
  await page.getByRole('tab', { name: 'Ambientes' }).click();
  await importar(page, 'Reimportar XML de Cozinha', 'Everaldo cozinha.xml', XML);
  await page.getByRole('dialog').getByRole('button', { name: 'Reimportar' }).click();
  await expect(page.getByText('Ambiente reimportado: 76 peças.')).toBeVisible();
  await expect(amb).toContainText('76 do Promob · 3 geradas · 2 avulsas');
});

test('XML com material desconhecido: cadastra o material na hora', async ({ page }, info) => {
  const id = unico(info);
  await entrar(page, COMUM);
  await criarProjeto(page, `Dormitório ${id}`);
  const xml = Buffer.from(
    XML.toString('utf8').replaceAll(
      'Fibraplac.Conceito.Linho Fendi',
      `Duratex.Freijo${id.replace(/\W/g, '')}`,
    ),
  );
  await importar(page, 'Escolher arquivo XML', 'dormitorio.xml', xml);
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByText('Materiais que o pro-cutter ainda não conhece')).toBeVisible();
  const seletor = dlg.getByLabel(/Material para/);
  await seletor.selectOption('novo');
  await dlg.getByLabel(/Descrição do material novo/).fill(`MDF Freijó ${id}`);
  await dlg.getByLabel('Tem veio').check();
  await dlg.getByRole('button', { name: 'Importar' }).click();
  await expect(dlg).toBeHidden();
  await page.getByRole('tab', { name: /Peças/ }).click();
  await expect(page.getByRole('region', { name: `Peças em MDF Freijó ${id}` })).toBeVisible();
});
