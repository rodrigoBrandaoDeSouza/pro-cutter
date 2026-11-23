import type { Material, Peca } from '@pro-cutter/core';
import { compilar } from './expressao.ts';
import {
  VARIAVEIS_DO_MODULO,
  type Modulo,
  type ParametroRegra,
  type TipoModulo,
  type ValoresRegras,
} from './tipos.ts';

export interface ErroRegra {
  peca: string;
  campo: 'condicao' | 'material' | 'quantidade' | 'comprimento' | 'largura';
  mensagem: string;
}

export function valoresDe(parametros: ParametroRegra[]): ValoresRegras {
  return Object.fromEntries(parametros.map((p) => [p.chave, p.valor]));
}

/** Herança Configurações → Projeto → Módulo. Projeto e módulo trazem só o que sobrescrevem. */
export function resolverRegras(
  config: ValoresRegras,
  projeto: Partial<ValoresRegras> = {},
  modulo: Partial<ValoresRegras> = {},
): ValoresRegras {
  const r: ValoresRegras = { ...config };
  for (const nivel of [projeto, modulo]) {
    for (const [chave, valor] of Object.entries(nivel)) {
      if (!Object.hasOwn(config, chave))
        throw new Error(`Parâmetro de regra desconhecido: ${chave}`);
      if (valor !== undefined) r[chave] = valor;
    }
  }
  return r;
}

const CAMPOS = ['quantidade', 'comprimento', 'largura'] as const;

/** Gera as peças (portas, fundos…) de um módulo a partir das fórmulas do seu tipo. */
export function gerarPecas(
  modulo: Modulo,
  tipo: TipoModulo,
  regras: ValoresRegras,
  materiais: Material[],
): { pecas: Peca[]; erros: ErroRegra[] } {
  const porId = new Map(materiais.map((m) => [m.id, m]));
  const mat = {
    caixa: porId.get(modulo.materiais.caixa),
    porta: modulo.materiais.porta ? porId.get(modulo.materiais.porta) : undefined,
    fundo: modulo.materiais.fundo ? porId.get(modulo.materiais.fundo) : undefined,
  };
  const extras = Object.fromEntries((tipo.extras ?? []).map((e) => [e.chave, e.padrao]));
  const vars: ValoresRegras = {
    ...regras,
    ...extras,
    ...modulo.extras,
    L: modulo.L,
    A: modulo.A,
    P: modulo.P,
    nPortas: modulo.nPortas,
    esp: mat.caixa?.espessura ?? 0,
    espPorta: mat.porta?.espessura ?? 0,
    espFundo: mat.fundo?.espessura ?? 0,
  };

  const pecas: Peca[] = [];
  const erros: ErroRegra[] = [];
  const ids = new Set<string>();

  for (const modelo of tipo.pecas) {
    const erro = (campo: ErroRegra['campo'], mensagem: string) =>
      erros.push({ peca: modelo.nome, campo, mensagem });
    try {
      if (modelo.condicao && compilar(modelo.condicao).avaliar(vars) === 0) continue;
    } catch (e) {
      erro('condicao', (e as Error).message);
      continue;
    }

    const material = mat[modelo.material];
    if (!material) {
      erro('material', `Módulo ${modulo.nome} sem material de ${modelo.material}`);
      continue;
    }

    const valores: Partial<Record<(typeof CAMPOS)[number], number>> = {};
    let falhou = false;
    for (const campo of CAMPOS) {
      try {
        const v = compilar(modelo[campo]).avaliar(vars);
        const arred = campo === 'quantidade' ? Math.round(v) : Math.round(v * 10) / 10;
        if (!Number.isFinite(arred) || (campo === 'quantidade' ? arred < 0 : arred <= 0)) {
          erro(campo, `${campo} inválido(a): ${arred}`);
          falhou = true;
          break;
        }
        valores[campo] = arred;
      } catch (e) {
        erro(campo, (e as Error).message);
        falhou = true;
        break;
      }
    }
    if (falhou || valores.quantidade === 0) continue;

    pecas.push({
      id: idUnico(`${modulo.id}:${slug(modelo.nome)}`, ids),
      nome: modelo.nome,
      tipo: modelo.tipo,
      comprimento: valores.comprimento!,
      largura: valores.largura!,
      espessura: material.espessura,
      quantidade: valores.quantidade!,
      materialId: material.id,
      fita: [...modelo.fita],
      podeGirar: (modelo.podeGirar ?? true) && !material.temVeio,
      origem: 'gerada',
      refs: {
        moduloId: modulo.id,
        ...(modulo.ambienteId ? { ambienteId: modulo.ambienteId } : {}),
      },
    });
  }
  return { pecas, erros };
}

/** Confere sintaxe e variáveis de todas as fórmulas de um tipo (para a tela de Configurações). */
export function validarTipoModulo(tipo: TipoModulo, chavesRegras: string[]): ErroRegra[] {
  const conhecidas = new Set<string>([
    ...VARIAVEIS_DO_MODULO,
    ...chavesRegras,
    ...(tipo.extras ?? []).map((e) => e.chave),
  ]);
  const erros: ErroRegra[] = [];
  for (const modelo of tipo.pecas) {
    const campos: [ErroRegra['campo'], string | undefined][] = [
      ['condicao', modelo.condicao],
      ...CAMPOS.map((c): [ErroRegra['campo'], string] => [c, modelo[c]]),
    ];
    for (const [campo, texto] of campos) {
      if (texto === undefined) continue;
      try {
        const desconhecidas = compilar(texto).variaveis.filter((v) => !conhecidas.has(v));
        if (desconhecidas.length) {
          erros.push({
            peca: modelo.nome,
            campo,
            mensagem: `variável desconhecida: ${desconhecidas.join(', ')}`,
          });
        }
      } catch (e) {
        erros.push({ peca: modelo.nome, campo, mensagem: (e as Error).message });
      }
    }
  }
  return erros;
}

function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function idUnico(base: string, usados: Set<string>): string {
  let id = base;
  for (let i = 2; usados.has(id); i++) id = `${base}-${i}`;
  usados.add(id);
  return id;
}
