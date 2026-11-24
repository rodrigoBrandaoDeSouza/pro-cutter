import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { proximoNivel, type ChapaPlano, type Nivel, type NoCorte } from '@pro-cutter/core';
import { amostrasProg } from './amostras.ts';
import { gerarProg, formatarNumero } from './gerar.ts';
import { lerProg } from './ler.ts';

describe('gerarProg', () => {
  for (const a of amostrasProg()) {
    it(`ida e volta byte a byte: ${a.nome}`, () => {
      const lido = lerProg(a.conteudo);
      const gerado = gerarProg(lido.chapa, {
        materialTexto: lido.materialTexto,
        espessura: lido.espessura,
        quantidade: lido.quantidade,
      });
      expect(gerado).toBe(a.conteudo);
    });
  }

  it('formata números como o Java (Double.toString)', () => {
    expect(formatarNumero(550)).toBe('550.0');
    expect(formatarNumero(0)).toBe('0.0');
    expect(formatarNumero(31.9)).toBe('31.9');
    expect(formatarNumero(0.5)).toBe('0.5');
  });

  it('recusa peça final depois de peça subdividida no mesmo grupo', () => {
    const chapa: ChapaPlano = {
      numero: 1,
      materialId: 'm',
      comprimento: 2750,
      largura: 1830,
      inicio: 'Y',
      nos: [
        {
          nivel: '1Y',
          medida: 500,
          filhos: [{ nivel: '2X', medida: 100, filhos: [], pecaId: 'a' }],
        },
        { nivel: '1Y', medida: 500, filhos: [], pecaId: 'b' },
      ],
    };
    expect(() => gerarProg(chapa, { materialTexto: 'x', espessura: 15 })).toThrow(/subdividid/);
  });

  it('propriedade: árvore aleatória → gerar → ler devolve a mesma árvore', () => {
    fc.assert(
      fc.property(arbChapa(), (chapa) => {
        const lido = lerProg(gerarProg(chapa, { materialTexto: 'MDF-15-X-X', espessura: 15 }));
        expect(semIds(lido.chapa.nos)).toEqual(semIds(chapa.nos));
        expect(lido.chapa.refilo).toEqual(chapa.refilo);
        expect(lido.chapa.inicio).toBe(chapa.inicio);
      }),
      { numRuns: 300 },
    );
  });
});

function semIds(nos: NoCorte[]): unknown[] {
  return nos.map((n) => ({
    nivel: n.nivel,
    medida: n.medida,
    refiloFilhos: n.refiloFilhos,
    filhos: semIds(n.filhos),
  }));
}

/** Gera grupos válidos: peças finais primeiro, depois nós subdivididos (regra da CVL). */
function arbGrupo(nivel: Nivel, profundidade: number): fc.Arbitrary<NoCorte[]> {
  const prox = proximoNivel(nivel);
  const folha = fc
    .integer({ min: 30, max: 2700 })
    .map((medida): NoCorte => ({ nivel, medida, filhos: [], pecaId: 'x' }));
  if (!prox || profundidade <= 0) return fc.array(folha, { minLength: 1, maxLength: 4 });
  const sub = fc
    .record({
      medida: fc.integer({ min: 30, max: 2700 }),
      refilo: fc.constantFrom(1, 5),
      filhos: fc.constant(null).chain(() => arbGrupo(prox, profundidade - 1)),
    })
    .map((r): NoCorte => ({ nivel, medida: r.medida, refiloFilhos: r.refilo, filhos: r.filhos }));
  return fc
    .tuple(fc.array(folha, { maxLength: 3 }), fc.array(sub, { maxLength: 3 }))
    .filter(([f, s]) => f.length + s.length > 0)
    .map(([f, s]) => [...f, ...s]);
}

function arbChapa(): fc.Arbitrary<ChapaPlano> {
  return fc.constantFrom<'X' | 'Y'>('X', 'Y').chain((inicio) =>
    fc
      .record({
        refilo: fc.constantFrom(5),
        nos: arbGrupo(inicio === 'X' ? '1X' : '1Y', inicio === 'X' ? 4 : 3),
      })
      .map((r): ChapaPlano => ({
        numero: 1,
        materialId: 'm',
        comprimento: 2750,
        largura: 1830,
        inicio,
        refilo: r.refilo,
        nos: r.nos,
      })),
  );
}
