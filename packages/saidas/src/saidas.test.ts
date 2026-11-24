import { readFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import type { Material, ParametrosCorte, Peca } from '@pro-cutter/core';
import { exportarPlano } from '@pro-cutter/cvl';
import { otimizarProjeto } from '@pro-cutter/otimizador';
import { converter, CONFIG_PADRAO, lerListagem } from '@pro-cutter/promob';
import type { DadosSaida } from './dados.ts';
import { consumoDeFita } from './fita.ts';
import { pdfDesenho } from './pdf-desenho.ts';
import { conteudoQr, pdfEtiquetas } from './pdf-etiquetas.ts';
import { MM, textoSeguro } from './pdf-util.ts';
import { pdfRelatorio, relatorioMaterial } from './relatorio.ts';
import { gerarZipProg } from './zip.ts';

const branco: Material = {
  id: 'branco',
  descricao: 'MDF Branco 15mm',
  espessura: 15,
  chapa: { comprimento: 2740, largura: 1840 },
  temVeio: false,
};
const linho: Material = {
  id: 'linho',
  descricao: 'MDF Fibraplac Linho Fendi 15mm',
  espessura: 15,
  chapa: { comprimento: 2750, largura: 1830 },
  temVeio: true,
};
const params: ParametrosCorte = {
  serra: 4,
  refiloFabrica: 5,
  refiloSerrado: 1,
  niveisMax: 3,
  sobraMinima: { comprimento: 300, largura: 300 },
};

const xml = readFileSync(
  new URL('../../../.doc/models/Everaldo cozinha.xml', import.meta.url),
  'utf8',
);
const { pecas } = converter(lerListagem(xml).ambientes[0]!, {
  ...CONFIG_PADRAO,
  materiais: [branco, linho],
  materialPorChave: { 'Branco|15': 'branco', 'Fibraplac.Conceito.Linho Fendi|15': 'linho' },
});
const plano = otimizarProjeto(pecas, [branco, linho], params, { iteracoes: 100, semente: 1 });

const dados: DadosSaida = {
  projeto: { id: 'proj1', nome: 'Cozinha Everaldo', cliente: 'Everaldo Gobbi' },
  plano: {
    versao: 3,
    criadoEm: new Date('2026-11-23T12:00:00Z'),
    parametros: params,
    chapas: plano.chapas,
    pecas,
    materiais: [branco, linho],
  },
  textoProg: {
    branco: 'MDF-15-Branco-MDF Branco 15mm',
    linho: 'MDF-15-Fibraplac.Conceito.Linho Fendi-MDF Fibraplac.Conceito.Linho Fendi 15mm',
  },
  nomes: { ambientes: {}, modulos: {} },
  etiqueta: { largura: 100, altura: 50 },
};

describe('ZIP de .prog', () => {
  it('um .prog por chapa, igual ao exportador e verificado', () => {
    const { bytes, arquivos } = gerarZipProg(dados);
    expect(arquivos).toEqual([
      'Cozinha Everaldo-MDF Branco 15mm.001.prog',
      'Cozinha Everaldo-MDF Branco 15mm.002.prog',
      'Cozinha Everaldo-MDF Branco 15mm.003.prog',
      'Cozinha Everaldo-MDF Fibraplac Linho Fendi 15mm.004.prog',
      'Cozinha Everaldo-MDF Fibraplac Linho Fendi 15mm.005.prog',
    ]);
    const conteudo = unzipSync(bytes);
    const esperado = exportarPlano(
      { chapas: plano.chapas },
      {
        projeto: 'Cozinha Everaldo',
        materiais: {
          branco: {
            materialTexto: dados.textoProg.branco!,
            espessura: 15,
            descricao: branco.descricao,
          },
          linho: {
            materialTexto: dados.textoProg.linho!,
            espessura: 15,
            descricao: linho.descricao,
          },
        },
      },
    );
    for (const a of esperado) expect(strFromU8(conteudo[a.nome]!)).toBe(a.conteudo);
  });

  it('material sem texto de .prog usa um padrão', () => {
    const { bytes } = gerarZipProg({ ...dados, textoProg: {} });
    const primeiro = Object.values(unzipSync(bytes))[0]!;
    expect(strFromU8(primeiro)).toContain('material="MDF-15-MDF Branco 15mm"');
  });
});

describe('fita de borda', () => {
  it('soma o lado certo de cada borda × quantidade', () => {
    const p = (fita: Peca['fita'], quantidade = 1): Peca => ({
      id: 'x',
      nome: 'x',
      comprimento: 1000,
      largura: 400,
      espessura: 15,
      quantidade,
      materialId: 'branco',
      fita,
      podeGirar: true,
      origem: 'manual',
    });
    expect(consumoDeFita([p([0.45, 0, 0, 0], 3), p([0, 0, 0.45, 0.45]), p([1, 0, 0, 0])])).toEqual([
      { materialId: 'branco', espessura: 0.45, metros: 3 + 0.8 },
      { materialId: 'branco', espessura: 1, metros: 1 },
    ]);
  });
});

describe('PDFs', () => {
  it('desenho: pelo menos uma página por chapa, A4 deitado', async () => {
    const doc = await PDFDocument.load(await pdfDesenho(dados));
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(5);
    const { width, height } = doc.getPage(0).getSize();
    expect(width).toBeGreaterThan(height);
  });

  it('etiquetas: uma página por peça, no tamanho configurado', async () => {
    const doc = await PDFDocument.load(await pdfEtiquetas(dados));
    expect(doc.getPageCount()).toBe(76);
    const { width, height } = doc.getPage(0).getSize();
    expect(width).toBeCloseTo(100 * MM);
    expect(height).toBeCloseTo(50 * MM);

    const pequena = await PDFDocument.load(
      await pdfEtiquetas({ ...dados, etiqueta: { largura: 60, altura: 40 } }),
    );
    expect(pequena.getPage(0).getSize().width).toBeCloseTo(60 * MM);
    expect(conteudoQr('proj1', 3, 12)).toBe('PC:proj1:3:12');
  });

  it('relatório: totais batem com as métricas e gera PDF', async () => {
    const r = relatorioMaterial(dados);
    expect(r.total.chapas).toBe(5);
    expect(r.total.pecas).toBe(76);
    expect(r.materiais.map((m) => [m.descricao, m.chapas])).toEqual([
      ['MDF Branco 15mm', 3],
      ['MDF Fibraplac Linho Fendi 15mm', 2],
    ]);
    expect(r.fita.length).toBeGreaterThan(0);
    for (const c of r.fita) expect(c.comFolga).toBeGreaterThanOrEqual(c.metros);
    const doc = await PDFDocument.load(await pdfRelatorio(dados));
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('textos com caracteres fora da fonte não quebram o PDF', async () => {
    const doc = await PDFDocument.create();
    const { StandardFonts } = await import('pdf-lib');
    const f = await doc.embedFont(StandardFonts.Helvetica);
    expect(textoSeguro(f, 'Ação ≈ 2 → ok 🙂 × ²')).toBe('Ação ~ 2 -> ok ? × ²');
    const comEmoji = { ...dados, projeto: { ...dados.projeto, nome: 'Cozinha 🙂 João' } };
    await expect(pdfEtiquetas(comEmoji)).resolves.toBeInstanceOf(Uint8Array);
  });
});
