import { describe, expect, it } from 'vitest';
import { metricas } from './metricas.ts';
import type { ChapaPlano } from './tipos.ts';

const OPS = { serra: 4, sobraMinima: { comprimento: 300, largura: 300 } };

const chapa = (numero: number, materialId: string): ChapaPlano => ({
  numero,
  materialId,
  comprimento: 2750,
  largura: 1830,
  inicio: 'Y',
  refilo: 5,
  nos: [
    {
      nivel: '1Y',
      medida: 500,
      refiloFilhos: 5,
      filhos: [
        { nivel: '2X', medida: 1000, filhos: [], pecaId: 'A' },
        { nivel: '2X', medida: 800, filhos: [], pecaId: 'B' },
      ],
    },
  ],
});

describe('metricas', () => {
  const m = metricas({ chapas: [chapa(1, 'branco'), chapa(2, 'branco'), chapa(3, 'linho')] }, OPS);

  it('por chapa: áreas, aproveitamento, sobra útil e perda', () => {
    expect(m.chapas[0]).toEqual({
      numero: 1,
      materialId: 'branco',
      pecas: 2,
      areaChapa: 5_032_500,
      areaPecas: 900_000,
      aproveitamento: 900_000 / 5_032_500,
      sobraUtil: 466_500 + 3_621_750,
      maiorSobraUtil: 3_621_750,
      perda: 5_032_500 - 900_000 - 4_088_250,
    });
  });

  it('por material e total do projeto', () => {
    expect(m.porMaterial.map((x) => [x.materialId, x.chapas, x.pecas])).toEqual([
      ['branco', 2, 4],
      ['linho', 1, 2],
    ]);
    expect(m.porMaterial[0]!.aproveitamento).toBeCloseTo(900_000 / 5_032_500);
    expect(m.total.chapas).toBe(3);
    expect(m.total.pecas).toBe(6);
    expect(m.total.areaPecas).toBe(2_700_000);
    expect(m.total.aproveitamento).toBeCloseTo(2_700_000 / (3 * 5_032_500));
  });

  it('plano vazio', () => {
    const v = metricas({ chapas: [] }, OPS);
    expect(v.total).toMatchObject({ chapas: 0, aproveitamento: 0 });
  });
});

describe('numerarPecas', () => {
  it('numera chapa a chapa, na ordem da geometria', async () => {
    const { numerarPecas } = await import('./numeracao.ts');
    const plano = { chapas: [chapa(1, 'branco'), chapa(2, 'linho')] };
    const r = numerarPecas(plano, OPS);
    expect(r.pecas.map((p) => [p.numero, p.chapa, p.indice, p.pecaId])).toEqual([
      [1, 1, 0, 'A'],
      [2, 1, 1, 'B'],
      [3, 2, 0, 'A'],
      [4, 2, 1, 'B'],
    ]);
    expect(r.geometrias).toHaveLength(2);
  });
});
