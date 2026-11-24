import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import { lerProg } from '@pro-cutter/cvl';
import { COMUM, criarProjeto, entrar, enviarXml, unico, XML_COZINHA } from './ajuda';

async function baixar(page: Page, acao: () => Promise<void>) {
  const [download] = await Promise.all([page.waitForEvent('download'), acao()]);
  return { nome: download.suggestedFilename(), bytes: readFileSync((await download.path())!) };
}

test('baixa o ZIP da CVL e os PDFs do plano', async ({ page }, info) => {
  test.setTimeout(150_000);
  const id = unico(info);
  await entrar(page, COMUM);
  await criarProjeto(page, `Saídas ${id}`);
  await enviarXml(page, 'Escolher arquivo XML', 'cozinha.xml', XML_COZINHA);
  await page.getByRole('dialog').getByRole('button', { name: 'Importar' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('tab', { name: /Plano de corte/ }).click();
  await page.getByRole('button', { name: 'Otimizar corte' }).click();
  await expect(page.getByText('Plano otimizado: 5 chapa(s).')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Fita de borda' })).toContainText('comprar');

  // ZIP: 5 .prog válidos, nomes sem acento
  const zip = await baixar(page, () => page.getByRole('button', { name: /Baixar ZIP/ }).click());
  expect(zip.nome).toBe(`Saídas ${id} - plano v1 - CVL.zip`);
  const arquivos = unzipSync(new Uint8Array(zip.bytes));
  const nomes = Object.keys(arquivos).sort();
  expect(nomes).toHaveLength(5);
  for (const n of nomes) {
    expect(n).toMatch(new RegExp(`^Saidas ${id}-MDF .+\\.00[1-5]\\.prog$`));
    expect(lerProg(strFromU8(arquivos[n]!)).chapa.nos.length).toBeGreaterThan(0);
  }
  await expect(page.getByText('Arquivos conferidos')).toBeVisible();

  // Etiquetas: uma página por peça
  const etiquetas = await baixar(page, async () => {
    await page.getByRole('button', { name: 'Outros arquivos do plano' }).click();
    await page.getByRole('menuitem', { name: 'Etiquetas (PDF)' }).click();
  });
  expect((await PDFDocument.load(etiquetas.bytes)).getPageCount()).toBe(76);

  for (const item of ['Desenho das chapas (PDF)', 'Relatório de material (PDF)']) {
    const pdf = await baixar(page, async () => {
      await page.getByRole('button', { name: 'Outros arquivos do plano' }).click();
      await page.getByRole('menuitem', { name: item }).click();
    });
    expect(pdf.bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect((await PDFDocument.load(pdf.bytes)).getPageCount()).toBeGreaterThanOrEqual(1);
  }

  // sem login, a rota não entrega o arquivo
  const url = new URL(page.url());
  const projetoId = url.pathname.split('/')[2];
  const anonimo = await page.context().browser()!.newContext();
  const r = await anonimo.request.get(`${url.origin}/projetos/${projetoId}/plano/1/prog.zip`, {
    maxRedirects: 0,
  });
  expect(r.status()).toBe(307);
  expect(r.headers().location).toContain('/entrar');
  await anonimo.close();
});
