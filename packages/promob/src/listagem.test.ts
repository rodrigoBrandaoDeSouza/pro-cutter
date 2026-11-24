import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { lerListagem } from './listagem.ts';

const xml = readFileSync(
  new URL('../../../.doc/models/Everaldo cozinha.xml', import.meta.url),
  'utf8',
);

describe('lerListagem (Everaldo cozinha.xml)', () => {
  const l = lerListagem(xml);

  it('lê dados do projeto e do cliente', () => {
    expect(l.projeto.guid).toBe('98773737-43bf-439b-a414-d8d181e123e2');
    expect(l.projeto.data).toBe('19/11/2026');
    expect(l.projeto.unidade).toBe('MM');
    expect(l.cliente).toEqual({ nome: 'Everaldo', telefone: '45999999999', email: 'e@e.com' });
  });

  it('lê 1 ambiente com 42 itens e 76 peças', () => {
    expect(l.ambientes).toHaveLength(1);
    const amb = l.ambientes[0]!;
    expect(amb.descricao).toBe('Projeto - cozinha Everaldo Gobbi');
    expect(amb.itens).toHaveLength(42);
    expect(amb.itens.reduce((s, i) => s + i.repeticao, 0)).toBe(76);
  });

  it('lê os campos de cada item', () => {
    const item = l.ambientes[0]!.itens.find((i) => i.uniqueId === '9555')!;
    expect(item).toEqual({
      uniqueId: '9555',
      idModelo: 'coz_comp_bas_bas_2015',
      descricao: 'Base 15',
      grupo: 'Bases',
      largura: 240,
      altura: 15,
      profundidade: 315,
      repeticao: 3,
      rotacao: 'N',
      material: 'MDF',
      modelo: 'Fibraplac.Conceito.Linho Fendi',
      modeloDescricao: 'Linho Fendi',
      espessura: 15,
      fitas: [0, 0, 0, 0.4],
      corFita: 'Linho Fendi',
      chapaMax: { comprimento: 2750, largura: 1830 },
      uniqueIdsAgrupados: ['9555', '9553', '9554'],
    });
  });

  it('item sem agrupamento e com rotação livre', () => {
    const item = l.ambientes[0]!.itens.find((i) => i.uniqueId === '9488')!;
    expect(item.uniqueIdsAgrupados).toEqual(['9488']);
    const branco = l.ambientes[0]!.itens.find((i) => i.uniqueId === '9571')!;
    expect(branco.rotacao).toBe('NONE');
    expect(branco.modelo).toBe('Branco');
  });

  it('aceita XML com um único item e sem BOM', () => {
    const mini = `<?xml version="1.0"?><LISTING UNIT="MM" DATE="01/01/2026"><PROJECTGUID GUID="g"/>
      <AMBIENTS><AMBIENT DESCRIPTION="A"><CATEGORIES><CATEGORY DESCRIPTION="C"><ITEMS>
      <ITEM UNIQUEID="1" ID="x" DESCRIPTION="P" GROUP="G" WIDTH="100" HEIGHT="15" DEPTH="200" REPETITION="2" PLATECUTTINGROTATE="NONE">
        <REFERENCES><MATERIAL REFERENCE="MDF"/><MODEL REFERENCE="Branco"/><THICKNESS REFERENCE="15"/></REFERENCES>
      </ITEM></ITEMS></CATEGORY></CATEGORIES></AMBIENT></AMBIENTS></LISTING>`;
    const r = lerListagem(mini);
    expect(r.ambientes[0]!.itens).toHaveLength(1);
    expect(r.ambientes[0]!.itens[0]!.fitas).toEqual([0, 0, 0, 0]);
    expect(r.cliente).toEqual({ nome: '', telefone: '', email: '' });
  });

  it('rejeita arquivo que não é listagem do Promob', () => {
    expect(() => lerListagem('<foo/>')).toThrow(/listagem do Promob/);
  });
});
