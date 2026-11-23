import { describe, expect, it } from 'vitest';
import { posicionar } from './geometria.ts';
import type { ChapaPlano } from './tipos.ts';

const SERRA = 4;

/** Chapa 2750×1830 começando em faixas: R1Y 5 · 1Y 500 { R2X 5 · 2X 1000 (A) · 2X 800 (B) } */
const chapaSimples: ChapaPlano = {
  numero: 1,
  materialId: 'm',
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
};

describe('posicionar', () => {
  const g = posicionar(chapaSimples, { serra: SERRA, sobraMinima: { comprimento: 300, largura: 300 } });

  it('posiciona as peças descontando refilo e serra', () => {
    expect(g.pecas).toEqual([
      { pecaId: 'A', x: 9, y: 9, c: 1000, l: 500 },
      { pecaId: 'B', x: 1013, y: 9, c: 800, l: 500 },
    ]);
  });

  it('gera os cortes na ordem de execução (separa a faixa, depois subdivide)', () => {
    expect(g.cortes.map((c) => [c.nivel, c.eixo, c.pos, c.refilo])).toEqual([
      ['1Y', 'Y', 5, true], // refilo da chapa
      ['1Y', 'Y', 509, false], // separa a faixa
      ['2X', 'X', 5, true], // refilo da faixa
      ['2X', 'X', 1009, false], // fim de A
      ['2X', 'X', 1813, false], // fim de B
    ]);
    // corte de faixa atravessa a chapa inteira no eixo X
    expect(g.cortes[0]).toMatchObject({ de: 0, ate: 2750 });
    // corte de coluna atravessa só a faixa no eixo Y
    expect(g.cortes[3]).toMatchObject({ de: 9, ate: 509 });
  });

  it('marca sobras úteis e perdas', () => {
    expect(g.sobras).toEqual([
      { x: 1817, y: 9, c: 933, l: 500, util: true },
      { x: 0, y: 513, c: 2750, l: 1317, util: true },
    ]);
  });

  it('sobra menor que o mínimo útil é perda', () => {
    const estreita: ChapaPlano = {
      ...chapaSimples,
      nos: [{ nivel: '1Y', medida: 1600, filhos: [], pecaId: 'C' }],
      refilo: 0,
    };
    const r = posicionar(estreita, { serra: SERRA, sobraMinima: { comprimento: 300, largura: 300 } });
    expect(r.sobras).toEqual([{ x: 0, y: 1604, c: 2750, l: 226, util: false }]);
  });

  it('começando em colunas (1X), subdivide em 1Y e depois 2X', () => {
    const colunas: ChapaPlano = {
      numero: 1,
      materialId: 'm',
      comprimento: 2740,
      largura: 1840,
      inicio: 'X',
      refilo: 5,
      nos: [
        {
          nivel: '1X',
          medida: 1550,
          refiloFilhos: 5,
          filhos: [
            { nivel: '1Y', medida: 550, filhos: [], pecaId: 'base' },
            {
              nivel: '1Y',
              medida: 330,
              refiloFilhos: 1,
              filhos: [{ nivel: '2X', medida: 1030, filhos: [], pecaId: 'lat' }],
            },
          ],
        },
      ],
    };
    const r = posicionar(colunas, { serra: SERRA, sobraMinima: { comprimento: 300, largura: 300 } });
    expect(r.pecas).toEqual([
      { pecaId: 'base', x: 9, y: 9, c: 1550, l: 550 },
      { pecaId: 'lat', x: 14, y: 563, c: 1030, l: 330 },
    ]);
  });
});
