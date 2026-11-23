import { describe, expect, it } from 'vitest';
import { validarPlano, type ContextoValidacao } from './validar.ts';
import type { ChapaPlano, Material, Peca, Plano } from './tipos.ts';

const branco: Material = {
  id: 'branco',
  descricao: 'Branco 15',
  espessura: 15,
  chapa: { comprimento: 2750, largura: 1830 },
  temVeio: false,
};
const linho: Material = { ...branco, id: 'linho', descricao: 'Linho 15', temVeio: true };

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

function chapa(nos: ChapaPlano['nos'], extra: Partial<ChapaPlano> = {}): ChapaPlano {
  return {
    numero: 1,
    materialId: 'branco',
    comprimento: 2750,
    largura: 1830,
    inicio: 'Y',
    refilo: 5,
    nos,
    ...extra,
  };
}

const ctxBase = (pecas: Peca[]): ContextoValidacao => ({
  pecas,
  materiais: [branco, linho],
  params: {
    serra: 4,
    refiloFabrica: 5,
    refiloSerrado: 1,
    niveisMax: 3,
    sobraMinima: { comprimento: 300, largura: 300 },
  },
});

const valido: Plano = {
  chapas: [
    chapa([
      {
        nivel: '1Y',
        medida: 500,
        refiloFilhos: 5,
        filhos: [
          { nivel: '2X', medida: 1000, filhos: [], pecaId: 'A' },
          { nivel: '2X', medida: 500, filhos: [], pecaId: 'B' },
        ],
      },
    ]),
  ],
};

const tipos = (plano: Plano, pecas: Peca[]) =>
  validarPlano(plano, ctxBase(pecas)).map((e) => e.tipo);

describe('validarPlano', () => {
  it('plano válido não tem erros', () => {
    const pecas = [peca('A', 1000, 500), peca('B', 500, 500)];
    expect(validarPlano(valido, ctxBase(pecas))).toEqual([]);
  });

  it('peça que ultrapassa a chapa', () => {
    const p: Plano = {
      chapas: [chapa([{ nivel: '1Y', medida: 1830, filhos: [], pecaId: 'A' }])],
    };
    expect(tipos(p, [peca('A', 2750, 1830)])).toContain('excede');
  });

  it('serra e refilo contam no espaço disponível', () => {
    // 2750 - (5 refilo + 4 serra) = 2741 úteis no X da faixa
    const cabe: Plano = {
      chapas: [
        chapa([
          {
            nivel: '1Y',
            medida: 500,
            refiloFilhos: 5,
            filhos: [{ nivel: '2X', medida: 2741, filhos: [], pecaId: 'A' }],
          },
        ]),
      ],
    };
    expect(tipos(cabe, [peca('A', 2741, 500)])).toEqual([]);
    const naoCabe = structuredClone(cabe);
    naoCabe.chapas[0]!.nos[0]!.filhos[0]!.medida = 2742;
    expect(tipos(naoCabe, [peca('A', 2742, 500)])).toContain('excede');
  });

  it('medida do nó diferente da peça', () => {
    expect(tipos(valido, [peca('A', 1000, 500), peca('B', 600, 500)])).toContain('medida');
  });

  it('peça com veio não pode estar girada', () => {
    const p: Plano = {
      chapas: [
        chapa(
          [
            {
              nivel: '1Y',
              medida: 1000,
              filhos: [{ nivel: '2X', medida: 500, filhos: [], pecaId: 'A' }],
            },
          ],
          { materialId: 'linho' },
        ),
      ],
    };
    const girada = peca('A', 1000, 500, { materialId: 'linho', podeGirar: false });
    expect(tipos(p, [girada])).toContain('girada');
    expect(tipos(p, [{ ...girada, comprimento: 500, largura: 1000 }])).toEqual([]);
  });

  it('quantidade diferente da pedida', () => {
    expect(tipos(valido, [peca('A', 1000, 500, { quantidade: 2 }), peca('B', 500, 500)])).toContain(
      'quantidade',
    );
  });

  it('peça desconhecida no plano', () => {
    expect(tipos(valido, [peca('A', 1000, 500)])).toContain('peca-desconhecida');
  });

  it('material errado na chapa, salvo material alternativo de mesma espessura', () => {
    const pecas = [peca('A', 1000, 500), peca('B', 500, 500, { materialId: 'linho' })];
    expect(tipos(valido, pecas)).toContain('material');
    pecas[1]!.materialAlternativo = true;
    expect(tipos(valido, pecas)).toEqual([]);
  });

  it('níveis fora da escada ou além do máximo', () => {
    const errado: Plano = {
      chapas: [chapa([{ nivel: '2X', medida: 500, filhos: [], pecaId: 'A' }])],
    };
    expect(tipos(errado, [peca('A', 500, 1830)])).toContain('nivel');

    const fundo = (nivel: '3Y'): Plano => ({
      chapas: [
        chapa([
          {
            nivel: '1Y',
            medida: 500,
            filhos: [
              {
                nivel: '2X',
                medida: 500,
                filhos: [
                  {
                    nivel: '2Y',
                    medida: 200,
                    filhos: [
                      {
                        nivel: '3X',
                        medida: 100,
                        filhos: [{ nivel, medida: 50, filhos: [], pecaId: 'A' }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ]),
      ],
    });
    expect(tipos(fundo('3Y'), [peca('A', 100, 50)])).toContain('niveis');
  });

  it('folha sem peça e chapa com tamanho diferente do material', () => {
    const p: Plano = {
      chapas: [chapa([{ nivel: '1Y', medida: 500, filhos: [] }], { comprimento: 2740 })],
    };
    const t = tipos(p, []);
    expect(t).toContain('folha-vazia');
    expect(t).toContain('chapa');
  });
});
