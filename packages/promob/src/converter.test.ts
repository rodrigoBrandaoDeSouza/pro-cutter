import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Material } from '@pro-cutter/core';
import { converter, CONFIG_PADRAO, type ConfigImportacao } from './converter.ts';
import { lerListagem } from './listagem.ts';

const listagem = lerListagem(
  readFileSync(new URL('../../../.doc/models/Everaldo cozinha.xml', import.meta.url), 'utf8'),
);

const branco: Material = {
  id: 'branco',
  descricao: 'MDF Branco 15',
  espessura: 15,
  chapa: { comprimento: 2740, largura: 1840 },
  temVeio: false,
};
const linho: Material = {
  id: 'linho',
  descricao: 'MDF Linho Fendi 15',
  espessura: 15,
  chapa: { comprimento: 2750, largura: 1830 },
  temVeio: true,
};

const config = (extra: Partial<ConfigImportacao> = {}): ConfigImportacao => ({
  ...CONFIG_PADRAO,
  materiais: [branco, linho],
  materialPorChave: {
    'Branco|15': 'branco',
    'Fibraplac.Conceito.Linho Fendi|15': 'linho',
  },
  ...extra,
});

const total = (pecas: { quantidade: number }[]) => pecas.reduce((s, p) => s + p.quantidade, 0);

describe('converter', () => {
  it('cozinha com os 2 materiais cadastrados: 76 peças, sem pendências', () => {
    const r = converter(listagem.ambientes[0]!, config());
    expect(r.pendencias).toEqual([]);
    expect(total(r.pecas)).toBe(76);
    expect(total(r.pecas.filter((p) => p.materialId === 'branco'))).toBe(47);
    expect(total(r.pecas.filter((p) => p.materialId === 'linho'))).toBe(29);
  });

  it('converte medidas, quantidade, giro, fita e referências', () => {
    const r = converter(listagem.ambientes[0]!, config());
    const base = r.pecas.find((p) => p.refs?.promobId === '9555')!;
    expect(base).toMatchObject({
      id: 'promob-9555',
      nome: 'Base 15',
      comprimento: 240,
      largura: 315,
      espessura: 15,
      quantidade: 3,
      materialId: 'linho',
      podeGirar: false,
      origem: 'xml',
      tipo: 'base',
    });
    // lado 4 do Promob → borda X superior (índice 0) no mapeamento padrão
    expect(base.fita).toEqual([0.4, 0, 0, 0]);

    const lateralBranca = r.pecas.find((p) => p.refs?.promobId === '9511')!;
    expect(lateralBranca.podeGirar).toBe(true);
    // lado 2 do Promob → borda X inferior (índice 1)
    expect(lateralBranca.fita).toEqual([0, 0.4, 0, 0]);
  });

  it('material sem cadastro vira pendência agrupada pela chave', () => {
    const r = converter(
      listagem.ambientes[0]!,
      config({ materialPorChave: { 'Branco|15': 'branco' } }),
    );
    expect(total(r.pecas)).toBe(47);
    expect(r.pendencias).toHaveLength(1);
    expect(r.pendencias[0]).toMatchObject({
      tipo: 'material-desconhecido',
      chave: 'Fibraplac.Conceito.Linho Fendi|15',
      descricao: 'MDF Fibraplac.Conceito.Linho Fendi 15mm',
    });
    expect(r.pendencias[0]!.itens).toHaveLength(18);
  });

  it('tipo marcado como "gera pelo pro-cutter" é ignorado com aviso', () => {
    const r = converter(
      listagem.ambientes[0]!,
      config({ origemPorTipo: { sarrafo: 'pro-cutter' } }),
    );
    expect(r.pecas.some((p) => p.tipo === 'sarrafo')).toBe(false);
    expect(r.pendencias).toEqual([
      expect.objectContaining({ tipo: 'ignorado', grupo: 'Sarrafos', itens: expect.any(Array) }),
    ]);
    expect(r.pendencias[0]!.itens).toHaveLength(8);
  });

  it('grupo sem mapeamento vira tipo "outro"', () => {
    const r = converter(listagem.ambientes[0]!, config({ mapaGrupos: {} }));
    expect(new Set(r.pecas.map((p) => p.tipo))).toEqual(new Set(['outro']));
  });

  it('item que não é chapa (sem espessura ou medida) vira pendência', () => {
    const amb = {
      descricao: 'x',
      itens: [{ ...listagem.ambientes[0]!.itens[0]!, espessura: 0, uniqueId: 'ferragem' }],
    };
    const r = converter(amb, config());
    expect(r.pecas).toEqual([]);
    expect(r.pendencias[0]).toMatchObject({ tipo: 'nao-chapa', itens: ['ferragem'] });
  });
});
