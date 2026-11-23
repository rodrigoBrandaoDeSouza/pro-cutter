import { describe, expect, it } from 'vitest';
import type { Material } from '@pro-cutter/core';
import { gerarPecas, resolverRegras, validarTipoModulo, valoresDe } from './gerar.ts';
import { PARAMETROS_PADRAO, TIPOS_PADRAO } from './padroes.ts';
import type { Modulo, TipoModulo } from './tipos.ts';

const mat = (id: string, espessura: number, temVeio = false): Material => ({
  id,
  descricao: id,
  espessura,
  chapa: { comprimento: 2750, largura: 1830 },
  temVeio,
});
const MATERIAIS = [mat('branco15', 15), mat('linho15', 15, true), mat('branco6', 6)];
const balcao = TIPOS_PADRAO.find((t) => t.id === 'balcao')!;

const modulo = (extra: Partial<Modulo> = {}): Modulo => ({
  id: 'm1',
  nome: 'Balcão pia',
  tipoId: 'balcao',
  L: 800,
  A: 720,
  P: 550,
  nPortas: 2,
  materiais: { caixa: 'branco15', porta: 'linho15', fundo: 'branco6' },
  ambienteId: 'amb1',
  ...extra,
});

describe('resolverRegras', () => {
  const config = valoresDe(PARAMETROS_PADRAO);

  it('herança Configurações → Projeto → Módulo', () => {
    const r = resolverRegras(config, { portaFolgaExt: 3 }, { portaFolgaEntre: 4 });
    expect(r.portaFolgaExt).toBe(3);
    expect(r.portaFolgaEntre).toBe(4);
    expect(r.fundoCanal).toBe(8);
  });

  it('módulo sobrescreve o projeto; campos ausentes não apagam', () => {
    const r = resolverRegras(
      config,
      { fundoCanal: 10 },
      { fundoCanal: 6, portaFolgaExt: undefined },
    );
    expect(r.fundoCanal).toBe(6);
    expect(r.portaFolgaExt).toBe(2);
  });

  it('chave desconhecida é erro (evita erro de digitação silencioso)', () => {
    expect(() => resolverRegras(config, {}, { folgaPortaa: 1 })).toThrow(/folgaPortaa/);
  });
});

describe('gerarPecas', () => {
  const regras = valoresDe(PARAMETROS_PADRAO);

  it('balcão 800×720 com 2 portas e fundo em canal', () => {
    const { pecas, erros } = gerarPecas(modulo(), balcao, regras, MATERIAIS);
    expect(erros).toEqual([]);
    expect(pecas).toEqual([
      {
        id: 'm1:porta',
        nome: 'Porta',
        tipo: 'porta',
        comprimento: 714,
        largura: 396.5,
        espessura: 15,
        quantidade: 2,
        materialId: 'linho15',
        fita: [0.45, 0.45, 0.45, 0.45],
        podeGirar: false, // linho tem veio
        origem: 'gerada',
        refs: { moduloId: 'm1', ambienteId: 'amb1' },
      },
      {
        id: 'm1:fundo',
        nome: 'Fundo',
        tipo: 'fundo',
        comprimento: 704, // 720 - 30 + 16 - 2
        largura: 784, // 800 - 30 + 16 - 2
        espessura: 6,
        quantidade: 1,
        materialId: 'branco6',
        fita: [0, 0, 0, 0],
        podeGirar: true,
        origem: 'gerada',
        refs: { moduloId: 'm1', ambienteId: 'amb1' },
      },
    ]);
  });

  it('regra sobrescrita no módulo: fundo sobreposto', () => {
    const r = resolverRegras(regras, {}, { fundoEmCanal: 0 });
    const fundo = gerarPecas(modulo(), balcao, r, MATERIAIS).pecas.find((p) => p.tipo === 'fundo')!;
    expect([fundo.comprimento, fundo.largura]).toEqual([718, 798]);
  });

  it('sem portas: a condição impede a peça', () => {
    const { pecas } = gerarPecas(modulo({ nPortas: 0 }), balcao, regras, MATERIAIS);
    expect(pecas.map((p) => p.tipo)).toEqual(['fundo']);
  });

  it('material não informado no módulo vira erro só da peça afetada', () => {
    const m = modulo({ materiais: { caixa: 'branco15', porta: 'linho15' } });
    const { pecas, erros } = gerarPecas(m, balcao, regras, MATERIAIS);
    expect(pecas.map((p) => p.tipo)).toEqual(['porta']);
    expect(erros).toEqual([
      { peca: 'Fundo', campo: 'material', mensagem: expect.stringMatching(/fundo/) },
    ]);
  });

  it('medida inválida (≤ 0) e fórmula com erro viram erro da peça', () => {
    const tipo: TipoModulo = {
      id: 't',
      nome: 't',
      pecas: [
        { ...balcao.pecas[0]!, nome: 'Negativa', largura: 'L - 5000' },
        { ...balcao.pecas[0]!, nome: 'Quebrada', comprimento: 'A + xyz' },
      ],
    };
    const { pecas, erros } = gerarPecas(modulo(), tipo, regras, MATERIAIS);
    expect(pecas).toEqual([]);
    expect(erros.map((e) => [e.peca, e.campo])).toEqual([
      ['Negativa', 'largura'],
      ['Quebrada', 'comprimento'],
    ]);
  });

  it('variáveis extras do tipo, com padrão', () => {
    const tipo: TipoModulo = {
      id: 'gav',
      nome: 'Gaveteiro',
      extras: [{ chave: 'nGavetas', rotulo: 'Gavetas', padrao: 3 }],
      pecas: [
        {
          nome: 'Frente de gaveta',
          tipo: 'porta',
          material: 'porta',
          quantidade: 'nGavetas',
          comprimento: 'L - 2*portaFolgaExt',
          largura: '(A - (nGavetas + 1)*portaFolgaVert) / nGavetas',
          fita: [0.45, 0.45, 0.45, 0.45],
        },
      ],
    };
    const p3 = gerarPecas(modulo(), tipo, regras, MATERIAIS).pecas[0]!;
    expect([p3.quantidade, p3.largura]).toEqual([3, 236]);
    const p4 = gerarPecas(modulo({ extras: { nGavetas: 4 } }), tipo, regras, MATERIAIS).pecas[0]!;
    expect([p4.quantidade, p4.largura]).toEqual([4, 176.3]);
  });
});

describe('validarTipoModulo', () => {
  const chaves = PARAMETROS_PADRAO.map((p) => p.chave);

  it('tipos de fábrica são válidos', () => {
    for (const t of TIPOS_PADRAO) expect(validarTipoModulo(t, chaves)).toEqual([]);
  });

  it('aponta sintaxe e variável desconhecida', () => {
    const tipo: TipoModulo = {
      id: 'x',
      nome: 'x',
      pecas: [{ ...balcao.pecas[0]!, comprimento: 'A - 2*', largura: 'L - folgaX' }],
    };
    expect(validarTipoModulo(tipo, chaves)).toEqual([
      { peca: 'Porta', campo: 'comprimento', mensagem: expect.stringMatching(/fim/) },
      { peca: 'Porta', campo: 'largura', mensagem: expect.stringMatching(/folgaX/) },
    ]);
  });
});
