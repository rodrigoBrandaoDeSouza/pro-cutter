import { describe, expect, it } from 'vitest';
import { posicionar } from '@pro-cutter/core';
import { amostrasProg } from './amostras.ts';
import { lerProg } from './ler.ts';

const amostras = amostrasProg();
const geo = (xml: string) =>
  posicionar(lerProg(xml).chapa, { serra: 4, sobraMinima: { comprimento: 300, largura: 300 } });

describe('lerProg', () => {
  it('existem as 5 amostras', () => {
    expect(amostras).toHaveLength(5);
  });

  it('lê cabeçalho da chapa', () => {
    const r = lerProg(amostras[0]!.conteudo);
    expect(r.materialTexto).toBe('MDF-15-Branco-MDF Branco 15mm');
    expect(r.quantidade).toBe(1);
    expect(r.espessura).toBe(15);
    expect(r.chapa).toMatchObject({ comprimento: 2740, largura: 1840, inicio: 'Y', refilo: 5 });
  });

  it('número de peças por chapa igual ao spike (18, 15, 13, 18, 12)', () => {
    expect(amostras.map((a) => geo(a.conteudo).pecas.length)).toEqual([18, 15, 13, 18, 12]);
  });

  it('chapa 004 (Linho Fendi) reconstrói a árvore com 3 níveis', () => {
    const r = lerProg(amostras[3]!.conteudo);
    expect(r.chapa.inicio).toBe('Y');
    const faixa = r.chapa.nos[0]!;
    expect(faixa).toMatchObject({ nivel: '1Y', medida: 710, refiloFilhos: 5 });
    expect(faixa.filhos.map((n) => [n.nivel, n.medida, n.filhos.length])).toEqual([
      ['2X', 2180, 0],
      ['2X', 150, 3], // 2Y 550 · 2Y 70 {3X 120} · 2Y 70 {3X 120}
      ['2X', 240, 2],
    ]);
    const col150 = faixa.filhos[1]!;
    expect(col150.refiloFilhos).toBe(1);
    expect(col150.filhos[1]).toMatchObject({ nivel: '2Y', medida: 70, refiloFilhos: 1 });
    expect(col150.filhos[1]!.filhos[0]).toMatchObject({ nivel: '3X', medida: 120 });
  });

  it('chapa 002 começa em colunas (1X) com refilo por coluna', () => {
    const r = lerProg(amostras[1]!.conteudo);
    expect(r.chapa.inicio).toBe('X');
    expect(r.chapa.refilo).toBe(5);
    expect(r.chapa.nos.map((n) => [n.nivel, n.medida, n.refiloFilhos])).toEqual([
      ['1X', 1550, 5],
      ['1X', 780, 5],
      ['1X', 330, 5],
    ]);
  });

  it('as medidas das peças batem com o spike', () => {
    const medidas = (i: number) => geo(amostras[i]!.conteudo).pecas.map((p) => `${p.c}x${p.l}`);
    expect(medidas(4)).toEqual([
      '2180x330',
      '740x330',
      '710x330',
      '710x330',
      '710x315',
      '710x315',
      '710x315',
      '710x315',
      '710x315',
      '680x240',
      '680x330',
      '240x315',
    ]);
  });

  it('rejeita arquivo que não é .prog', () => {
    expect(() => lerProg('<foo/>')).toThrow(/\.prog/);
  });
});
