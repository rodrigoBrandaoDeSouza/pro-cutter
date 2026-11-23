import { describe, expect, it } from 'vitest';
import type { Plano } from '@pro-cutter/core';
import { amostrasProg } from './amostras.ts';
import { exportarPlano, nomeArquivo, verificarExportacao } from './exportar.ts';
import { lerProg } from './ler.ts';

const OPS = { serra: 4 };

const plano: Plano = {
  chapas: amostrasProg().map((a, i) => {
    const { chapa } = lerProg(a.conteudo, i + 1);
    return { ...chapa, materialId: a.nome.includes('Linho') ? 'linho' : 'branco' };
  }),
};
const materiais = {
  branco: {
    materialTexto: 'MDF-15-Branco-MDF Branco 15mm',
    espessura: 15,
    descricao: 'MDF Branco 15mm',
  },
  linho: {
    materialTexto: 'MDF-15-Fibraplac.Conceito.Linho Fendi-MDF Fibraplac.Conceito.Linho Fendi 15mm',
    espessura: 15,
    descricao: 'MDF Fibraplac.Conceito.Linho Fendi 15mm',
  },
};

describe('nomeArquivo', () => {
  it('segue o padrão <projeto>-<material>.<nnn>.prog', () => {
    expect(nomeArquivo('Everaldo cozinha.xml', 'MDF Branco 15mm', 1)).toBe(
      'Everaldo cozinha.xml-MDF Branco 15mm.001.prog',
    );
  });

  it('troca caracteres inválidos em nome de arquivo', () => {
    expect(nomeArquivo('Obra 1/2: "Ana"', 'Cor*?', 12)).toBe('Obra 1_2_ _Ana_-Cor__.012.prog');
  });
});

describe('exportarPlano + verificarExportacao', () => {
  it('reproduz os nomes e conteúdos das amostras reais', () => {
    const arquivos = exportarPlano(plano, { projeto: 'Everaldo cozinha.xml', materiais });
    const amostras = amostrasProg();
    expect(arquivos.map((a) => a.nome)).toEqual(amostras.map((a) => a.nome));
    expect(arquivos.map((a) => a.conteudo)).toEqual(amostras.map((a) => a.conteudo));
  });

  it('plano exportado é verificado sem erros', () => {
    const arquivos = exportarPlano(plano, { projeto: 'P', materiais });
    expect(verificarExportacao(plano, arquivos, OPS)).toEqual([]);
  });

  it('detecta arquivo adulterado, faltando ou sobrando', () => {
    const arquivos = exportarPlano(plano, { projeto: 'P', materiais });
    const adulterado = arquivos.map((a, i) =>
      i === 2 ? { ...a, conteudo: a.conteudo.replace('value="650.0"', 'value="651.0"') } : a,
    );
    expect(verificarExportacao(plano, adulterado, OPS)).toEqual([
      expect.objectContaining({ chapa: 3 }),
    ]);
    expect(verificarExportacao(plano, arquivos.slice(1), OPS)).toEqual([
      expect.objectContaining({ chapa: 1, mensagem: expect.stringMatching(/sem arquivo/) }),
    ]);
  });

  it('material sem texto configurado é erro claro', () => {
    expect(() =>
      exportarPlano(plano, { projeto: 'P', materiais: { branco: materiais.branco } }),
    ).toThrow(/linho/);
  });
});
