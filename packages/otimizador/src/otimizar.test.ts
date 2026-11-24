import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  indiceNivel,
  validarPlano,
  type Material,
  type NoCorte,
  type ParametrosCorte,
  type Peca,
} from '@pro-cutter/core';
import { gerarProg, lerProg } from '@pro-cutter/cvl';
import { converter, CONFIG_PADRAO, lerListagem } from '@pro-cutter/promob';
import { otimizar } from './otimizar.ts';

const PARAMS: ParametrosCorte = {
  serra: 4,
  refiloFabrica: 5,
  refiloSerrado: 1,
  niveisMax: 3,
  sobraMinima: { comprimento: 300, largura: 300 },
};

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

function erros(pecas: Peca[], material: Material, params = PARAMS) {
  const r = otimizar(pecas, material, params, { iteracoes: 60, semente: 1 });
  return { r, erros: validarPlano({ chapas: r.chapas }, { pecas, materiais: [material], params }) };
}

function profundidadeMax(nos: NoCorte[]): number {
  return Math.max(-1, ...nos.map((n) => Math.max(indiceNivel(n.nivel), profundidadeMax(n.filhos))));
}

describe('otimizar: casos básicos', () => {
  it('uma peça', () => {
    const { r, erros: e } = erros([peca('a', 500, 300)], branco);
    expect(e).toEqual([]);
    expect(r.chapas).toHaveLength(1);
  });

  it('peça do tamanho útil máximo da chapa', () => {
    // útil = 2740 - (5+4) refilo da chapa, e na faixa: 1840 - (5+4)
    const { r, erros: e } = erros([peca('a', 2731, 1831, { podeGirar: false })], branco);
    expect(e).toEqual([]);
    expect(r.chapas).toHaveLength(1);
  });

  it('peça maior que a chapa gera erro claro', () => {
    expect(() => otimizar([peca('a', 3000, 500, { podeGirar: false })], branco, PARAMS)).toThrow(
      /não cabe/,
    );
  });

  it('quantidade > 1 e várias chapas', () => {
    const { r, erros: e } = erros([peca('a', 1300, 900, { quantidade: 9 })], branco);
    expect(e).toEqual([]);
    expect(r.chapas.length).toBeGreaterThanOrEqual(3);
  });

  it('peças com veio nunca giram', () => {
    const pecas = [
      peca('a', 2000, 600, { materialId: 'linho', podeGirar: false, quantidade: 3 }),
      peca('b', 300, 700, { materialId: 'linho', podeGirar: false, quantidade: 5 }),
    ];
    const { erros: e } = erros(pecas, linho);
    expect(e).toEqual([]);
  });

  it('com niveisMax = 2 nenhum nó passa de 2X', () => {
    const pecas = [peca('a', 700, 300, { quantidade: 6 }), peca('b', 400, 250, { quantidade: 7 })];
    const params = { ...PARAMS, niveisMax: 2 };
    const { r, erros: e } = erros(pecas, branco, params);
    expect(e).toEqual([]);
    for (const ch of r.chapas)
      expect(profundidadeMax(ch.nos)).toBeLessThanOrEqual(indiceNivel('2X'));
  });

  it('o 3º nível aproveita peças baixas lado a lado', () => {
    // 20 sarrafos 300×70 + uma base alta que define a faixa
    const pecas = [
      peca('alta', 2000, 600, { podeGirar: false }),
      peca('s', 300, 70, { quantidade: 20, podeGirar: false }),
    ];
    const { r, erros: e } = erros(pecas, branco);
    expect(e).toEqual([]);
    expect(r.chapas).toHaveLength(1);
  });

  it('resultado determinístico para a mesma semente', () => {
    const pecas = [peca('a', 813, 377, { quantidade: 7 }), peca('b', 1201, 455, { quantidade: 4 })];
    const a = otimizar(pecas, branco, PARAMS, { iteracoes: 40, semente: 7 });
    const b = otimizar(pecas, branco, PARAMS, { iteracoes: 40, semente: 7 });
    expect(a).toEqual(b);
  });
});

describe('otimizar: propriedades', () => {
  const arbPecas = fc.array(
    fc.record({
      c: fc.integer({ min: 40, max: 2700 }),
      l: fc.integer({ min: 40, max: 1800 }),
      q: fc.integer({ min: 1, max: 6 }),
      gira: fc.boolean(),
    }),
    { minLength: 1, maxLength: 12 },
  );

  it('todo plano gerado é válido e aceito pelo gerador .prog', () => {
    fc.assert(
      fc.property(arbPecas, fc.constantFrom(2, 3), (specs, niveisMax) => {
        const pecas = specs.map((s, i) =>
          peca(`p${i}`, s.c, s.l, { quantidade: s.q, podeGirar: s.gira }),
        );
        const params = { ...PARAMS, niveisMax };
        const r = otimizar(pecas, branco, params, { iteracoes: 8, semente: 3 });
        expect(validarPlano({ chapas: r.chapas }, { pecas, materiais: [branco], params })).toEqual(
          [],
        );
        for (const ch of r.chapas) {
          const xml = gerarProg(ch, { materialTexto: 'MDF-15-Branco', espessura: 15 });
          expect(lerProg(xml).chapa.nos.length).toBe(ch.nos.length);
        }
      }),
      { numRuns: 200 },
    );
  });
});

describe('otimizar: regressão com a cozinha do Everaldo', () => {
  const xml = readFileSync(
    new URL('../../../.doc/models/Everaldo cozinha.xml', import.meta.url),
    'utf8',
  );
  const { pecas } = converter(lerListagem(xml).ambientes[0]!, {
    ...CONFIG_PADRAO,
    materiais: [branco, linho],
    materialPorChave: { 'Branco|15': 'branco', 'Fibraplac.Conceito.Linho Fendi|15': 'linho' },
  });

  for (const [mat, max] of [
    [branco, 3],
    [linho, 2],
  ] as const) {
    it(`${mat.descricao}: no máximo ${max} chapas, plano válido`, () => {
      const doMaterial = pecas.filter((p) => p.materialId === mat.id);
      const r = otimizar(doMaterial, mat, PARAMS, { iteracoes: 300, semente: 1 });
      expect(
        validarPlano({ chapas: r.chapas }, { pecas: doMaterial, materiais: [mat], params: PARAMS }),
      ).toEqual([]);
      expect(r.chapas.length).toBeLessThanOrEqual(max);
    });
  }
});
