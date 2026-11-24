import { describe, expect, it } from 'vitest';
import { avaliar, compilar, ErroExpressao } from './expressao.ts';

const v = { L: 800, A: 720, P: 550, nPortas: 2, folga: 2.5 };

describe('avaliador de expressões', () => {
  it.each([
    ['1 + 2 * 3', 7],
    ['(1 + 2) * 3', 9],
    ['10 - 4 - 3', 3],
    ['2 * -3', -6],
    ['-(4 + 1)', -5],
    ['1,5 + 1.5', 3],
    ['L / nPortas', 400],
    ['(L - 2*folga - (nPortas-1)*3) / nPortas', 396],
    ['min(L; A; 100)', 100],
    ['max(L; A)', 800],
    ['arred(2,5)', 3],
    ['arred(2,44; 1)', 2.4],
    ['piso(7,9)', 7],
    ['teto(7,1)', 8],
    ['se(nPortas > 1; 10; 20)', 10],
    ['se(nPortas = 1; 10; 20)', 20],
    ['se(L >= 800; 1; 0) + se(A <> 720; 1; 0)', 1],
    ['se(A <= 719; 1; 0)', 0],
  ])('%s = %d', (expr, esperado) => {
    expect(avaliar(expr, v)).toBeCloseTo(esperado);
  });

  it('lista as variáveis usadas', () => {
    expect(compilar('(L - 2*folga) / nPortas + max(A; 1)').variaveis).toEqual([
      'L',
      'folga',
      'nPortas',
      'A',
    ]);
  });

  it.each([
    ['', /vazia/],
    ['1 +', /fim/],
    ['(1 + 2', /\)/],
    ['1 + 2)', /inesperado/],
    ['2 $ 3', /caractere/],
    ['foo(1)', /função desconhecida/],
    ['min()', /argumento/],
    ['se(1; 2)', /3 argumentos/],
  ])('erro de sintaxe: "%s"', (expr, msg) => {
    expect(() => compilar(expr)).toThrow(msg);
  });

  it('erros informam a posição', () => {
    try {
      compilar('L + * 2');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ErroExpressao);
      expect((e as ErroExpressao).posicao).toBe(4);
    }
  });

  it('variável desconhecida e divisão por zero', () => {
    expect(() => avaliar('X + 1', v)).toThrow(/variável desconhecida: X/);
    expect(() => avaliar('L / (nPortas - 2)', v)).toThrow(/divisão por zero/);
  });

  it.each(['constructor', '__proto__', 'toString', 'process', 'globalThis', 'hasOwnProperty'])(
    'não acessa nada fora das variáveis: %s',
    (nome) => {
      expect(() => avaliar(nome, v)).toThrow(/variável desconhecida/);
      expect(() => avaliar(`${nome}(1)`, v)).toThrow(/função desconhecida/);
    },
  );

  it('não aceita código JavaScript', () => {
    expect(() => compilar('L; process.exit()')).toThrow();
    expect(() => compilar('L.constructor')).toThrow();
    expect(() => compilar('`x`')).toThrow();
  });
});
