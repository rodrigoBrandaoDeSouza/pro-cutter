import type { Fitas, Material, Peca } from '@pro-cutter/core';
import type { AmbientePromob, ItemPromob } from './listagem.ts';

export type OrigemTipo = 'promob' | 'pro-cutter';

/** Índice da borda no pro-cutter: 0 = X superior, 1 = X inferior, 2 = Y esquerda, 3 = Y direita. */
export type Borda = 0 | 1 | 2 | 3;

export interface ConfigImportacao {
  materiais: Material[];
  /** Chave `${modelo}|${espessura}` do Promob → id do Material. */
  materialPorChave: Record<string, string>;
  /** GROUP do Promob → tipo de peça. Sem mapeamento = 'outro'. */
  mapaGrupos: Record<string, string>;
  /** Tipo de peça → quem fornece. Tipos 'pro-cutter' são ignorados na importação. Padrão: 'promob'. */
  origemPorTipo: Record<string, OrigemTipo>;
  /** Lado do Promob (FITA_BORDA_1..4, posição 0..3) → borda do pro-cutter. */
  ladosFita: [Borda, Borda, Borda, Borda];
}

/**
 * Padrões de fábrica. Os lados da fita são um palpite baseado na cozinha de exemplo
 * (bases com fita no lado 4 e laterais no lado 2, ambas na borda da frente, que acompanha WIDTH/eixo X).
 */
export const CONFIG_PADRAO: Omit<ConfigImportacao, 'materiais' | 'materialPorChave'> = {
  mapaGrupos: {
    Bases: 'base',
    'Laterais/Divisórias': 'lateral',
    Sarrafos: 'sarrafo',
    Portas: 'porta',
    Fundos: 'fundo',
    Prateleiras: 'prateleira',
  },
  origemPorTipo: {},
  ladosFita: [2, 1, 3, 0],
};

export type Pendencia =
  | { tipo: 'material-desconhecido'; chave: string; descricao: string; itens: string[] }
  | { tipo: 'ignorado'; grupo: string; tipoPeca: string; itens: string[] }
  | { tipo: 'nao-chapa'; itens: string[] };

export interface ResultadoConversao {
  pecas: Peca[];
  pendencias: Pendencia[];
}

export function chaveMaterial(item: Pick<ItemPromob, 'modelo' | 'espessura'>): string {
  return `${item.modelo}|${item.espessura}`;
}

export function converter(ambiente: AmbientePromob, config: ConfigImportacao): ResultadoConversao {
  const materiais = new Map(config.materiais.map((m) => [m.id, m]));
  const pecas: Peca[] = [];
  const desconhecidos = new Map<string, { descricao: string; itens: string[] }>();
  const ignorados = new Map<string, { tipoPeca: string; itens: string[] }>();
  const naoChapa: string[] = [];

  for (const item of ambiente.itens) {
    if (!item.espessura || !item.largura || !item.profundidade) {
      naoChapa.push(item.uniqueId);
      continue;
    }

    const tipo = config.mapaGrupos[item.grupo] ?? 'outro';
    if ((config.origemPorTipo[tipo] ?? 'promob') === 'pro-cutter') {
      const g = ignorados.get(item.grupo) ?? { tipoPeca: tipo, itens: [] };
      g.itens.push(item.uniqueId);
      ignorados.set(item.grupo, g);
      continue;
    }

    const chave = chaveMaterial(item);
    const materialId = config.materialPorChave[chave];
    const material = materialId ? materiais.get(materialId) : undefined;
    if (!material) {
      const d = desconhecidos.get(chave) ?? {
        descricao: `${item.material} ${item.modelo} ${item.espessura}mm`,
        itens: [],
      };
      d.itens.push(item.uniqueId);
      desconhecidos.set(chave, d);
      continue;
    }

    pecas.push({
      id: `promob-${item.uniqueId}`,
      nome: item.descricao,
      tipo,
      comprimento: item.largura,
      largura: item.profundidade,
      espessura: item.espessura,
      quantidade: item.repeticao,
      materialId: material.id,
      fita: mapearFita(item.fitas, config.ladosFita),
      podeGirar: item.rotacao !== 'N' && !material.temVeio,
      origem: 'xml',
      refs: { promobId: item.uniqueId },
    });
  }

  const pendencias: Pendencia[] = [
    ...[...desconhecidos].map(([chave, d]) => ({
      tipo: 'material-desconhecido' as const,
      chave,
      ...d,
    })),
    ...[...ignorados].map(([grupo, g]) => ({ tipo: 'ignorado' as const, grupo, ...g })),
    ...(naoChapa.length ? [{ tipo: 'nao-chapa' as const, itens: naoChapa }] : []),
  ];
  return { pecas, pendencias };
}

function mapearFita(fitas: ItemPromob['fitas'], lados: ConfigImportacao['ladosFita']): Fitas {
  const r: Fitas = [0, 0, 0, 0];
  fitas.forEach((esp, i) => {
    const borda = lados[i];
    if (borda !== undefined && esp > 0) r[borda] = esp;
  });
  return r;
}
