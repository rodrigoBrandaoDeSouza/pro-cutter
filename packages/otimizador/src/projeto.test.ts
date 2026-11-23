import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  posicionar,
  validarPlano,
  type Material,
  type ParametrosCorte,
  type Peca,
  type Plano,
} from '@pro-cutter/core';
import { exportarPlano, verificarExportacao } from '@pro-cutter/cvl';
import { converter, CONFIG_PADRAO, lerListagem } from '@pro-cutter/promob';
import { otimizar } from './otimizar.ts';
import { otimizarProjeto } from './projeto.ts';

const PARAMS: ParametrosCorte = {
  serra: 4,
  refiloFabrica: 5,
  refiloSerrado: 1,
  niveisMax: 3,
  sobraMinima: { comprimento: 300, largura: 300 },
};
const OP = { iteracoes: 40, semente: 1 };

const branco: Material = {
  id: 'branco',
  descricao: 'MDF Branco 15mm',
  espessura: 15,
  chapa: { comprimento: 2740, largura: 1840 },
  temVeio: false,
};
const linho: Material = {
  id: 'linho',
  descricao: 'MDF Linho Fendi 15mm',
  espessura: 15,
  chapa: { comprimento: 2750, largura: 1830 },
  temVeio: true,
};
const mdf6: Material = { ...branco, id: 'mdf6', descricao: 'MDF Branco 6mm', espessura: 6 };

function peca(id: string, c: number, l: number, extra: Partial<Peca> = {}): Peca {
  return {
    id,
    nome: id,
    comprimento: c,
    largura: l,
    espessura: 15,
    quantidade: 1,
    materialId: 'branco',
    fita: [0, 0, 0, 0],
    podeGirar: true,
    origem: 'manual',
    ...extra,
  };
}

/** Em que chapa (número) está cada unidade da peça. */
function chapasDa(plano: Plano, pecaId: string): number[] {
  return plano.chapas.flatMap((ch) =>
    posicionar(ch, { serra: 4, sobraMinima: { comprimento: 0, largura: 0 } })
      .pecas.filter((p) => p.pecaId === pecaId)
      .map(() => ch.numero),
  );
}

const valido = (plano: Plano, pecas: Peca[], materiais: Material[]) =>
  validarPlano(plano, { pecas, materiais, params: PARAMS });

describe('peças fixadas', () => {
  const muitas = [peca('a', 1300, 900, { quantidade: 8 }), peca('alvo', 400, 400)];

  it('fica na chapa indicada', () => {
    const r = otimizar(muitas, branco, PARAMS, { ...OP, fixadas: [{ pecaId: 'alvo', chapa: 2 }] });
    expect(chapasDa({ chapas: r.chapas }, 'alvo')).toEqual([2]);
    expect(valido({ chapas: r.chapas }, muitas, [branco])).toEqual([]);
  });

  it('fixada numa chapa que não vai existir desce para a última', () => {
    const r = otimizar(muitas, branco, PARAMS, { ...OP, fixadas: [{ pecaId: 'alvo', chapa: 9 }] });
    expect(chapasDa({ chapas: r.chapas }, 'alvo')).toEqual([r.chapas.length]);
  });

  it('fixadas demais para uma chapa geram erro claro', () => {
    const grandes = [peca('g', 2000, 1500, { quantidade: 2, podeGirar: false })];
    expect(() =>
      otimizar(grandes, branco, PARAMS, { ...OP, fixadas: [{ pecaId: 'g', chapa: 1 }] }),
    ).toThrow(/fixada na chapa 1/);
  });
});

describe('material alternativo', () => {
  it('peça alternativa vai para a sobra de outro material de mesma espessura', () => {
    const pecas = [
      peca('base', 2000, 1500, { podeGirar: false }),
      peca('sarrafo', 300, 70, {
        materialId: 'linho',
        materialAlternativo: true,
        podeGirar: false,
      }),
    ];
    const plano = otimizarProjeto(pecas, [branco, linho], PARAMS, OP);
    expect(plano.chapas).toHaveLength(1);
    expect(plano.chapas[0]!.materialId).toBe('branco');
    expect(valido(plano, pecas, [branco, linho])).toEqual([]);
  });

  it('não ocupa material de outra espessura; volta para o próprio', () => {
    const pecas = [
      peca('fundo', 2000, 1500, { materialId: 'mdf6', espessura: 6, podeGirar: false }),
      peca('sarrafo', 300, 70, { materialAlternativo: true }),
    ];
    const plano = otimizarProjeto(pecas, [branco, mdf6], PARAMS, OP);
    expect(plano.chapas.map((c) => c.materialId).sort()).toEqual(['branco', 'mdf6']);
    expect(valido(plano, pecas, [branco, mdf6])).toEqual([]);
  });

  it('sem espaço em outro material, volta para o próprio', () => {
    const pecas = [
      peca('cheia', 2731, 1831, { podeGirar: false }),
      peca('alt', 500, 500, { materialId: 'linho', materialAlternativo: true }),
    ];
    const plano = otimizarProjeto(pecas, [branco, linho], PARAMS, OP);
    expect(plano.chapas.map((c) => c.materialId)).toEqual(['branco', 'linho']);
    expect(valido(plano, pecas, [branco, linho])).toEqual([]);
  });
});

describe('otimizarProjeto: cozinha do Everaldo inteira', () => {
  const xml = readFileSync(
    new URL('../../../.doc/models/Everaldo cozinha.xml', import.meta.url),
    'utf8',
  );
  const { pecas } = converter(lerListagem(xml).ambientes[0]!, {
    ...CONFIG_PADRAO,
    materiais: [branco, linho],
    materialPorChave: { 'Branco|15': 'branco', 'Fibraplac.Conceito.Linho Fendi|15': 'linho' },
  });

  it('5 chapas numeradas em sequência, plano válido e exportável', () => {
    const plano = otimizarProjeto(pecas, [branco, linho], PARAMS, { iteracoes: 200, semente: 1 });
    expect(plano.chapas.map((c) => [c.numero, c.materialId])).toEqual([
      [1, 'branco'],
      [2, 'branco'],
      [3, 'branco'],
      [4, 'linho'],
      [5, 'linho'],
    ]);
    expect(valido(plano, pecas, [branco, linho])).toEqual([]);

    const arquivos = exportarPlano(plano, {
      projeto: 'Everaldo cozinha',
      materiais: {
        branco: {
          materialTexto: 'MDF-15-Branco-MDF Branco 15mm',
          espessura: 15,
          descricao: 'MDF Branco 15mm',
        },
        linho: {
          materialTexto:
            'MDF-15-Fibraplac.Conceito.Linho Fendi-MDF Fibraplac.Conceito.Linho Fendi 15mm',
          espessura: 15,
          descricao: 'MDF Fibraplac.Conceito.Linho Fendi 15mm',
        },
      },
    });
    expect(arquivos.map((a) => a.nome)).toEqual([
      'Everaldo cozinha-MDF Branco 15mm.001.prog',
      'Everaldo cozinha-MDF Branco 15mm.002.prog',
      'Everaldo cozinha-MDF Branco 15mm.003.prog',
      'Everaldo cozinha-MDF Fibraplac.Conceito.Linho Fendi 15mm.004.prog',
      'Everaldo cozinha-MDF Fibraplac.Conceito.Linho Fendi 15mm.005.prog',
    ]);
    expect(verificarExportacao(plano, arquivos, { serra: 4 })).toEqual([]);
  });
});
