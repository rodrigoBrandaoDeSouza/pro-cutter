import type { Fitas } from '@pro-cutter/core';

/** Parâmetro de regra configurável pela marcenaria (ex.: folga da porta). Valores em mm salvo indicação. */
export interface ParametroRegra {
  chave: string;
  rotulo: string;
  valor: number;
  unidade?: string;
  grupo?: string;
  ajuda?: string;
}

export type ValoresRegras = Record<string, number>;

export type MaterialDoModulo = 'caixa' | 'porta' | 'fundo';

/** Uma peça que um tipo de módulo gera, com fórmulas. */
export interface ModeloPeca {
  nome: string;
  /** Tipo de peça (porta, fundo…), o mesmo usado em "origem por tipo" na importação. */
  tipo: string;
  material: MaterialDoModulo;
  quantidade: string;
  /** Medida no sentido do veio (eixo X da chapa). Na porta, a altura. */
  comprimento: string;
  largura: string;
  fita: Fitas;
  /** Fórmula opcional: a peça só é gerada se o resultado for diferente de 0. */
  condicao?: string;
  /** Padrão true; o veio do material sempre prevalece. */
  podeGirar?: boolean;
}

export interface VariavelExtra {
  chave: string;
  rotulo: string;
  padrao: number;
}

export interface TipoModulo {
  id: string;
  nome: string;
  pecas: ModeloPeca[];
  /** Variáveis próprias do tipo, informadas em cada módulo (ex.: nGavetas). */
  extras?: VariavelExtra[];
}

export interface Modulo {
  id: string;
  nome: string;
  tipoId: string;
  /** Largura, altura e profundidade do módulo (mm). */
  L: number;
  A: number;
  P: number;
  nPortas: number;
  materiais: { caixa: string; porta?: string; fundo?: string };
  /** Só os parâmetros sobrescritos neste módulo. */
  regras?: Partial<ValoresRegras>;
  extras?: Record<string, number>;
  ambienteId?: string;
}

/** Variáveis que toda fórmula enxerga, além dos parâmetros de regra e extras. */
export const VARIAVEIS_DO_MODULO = [
  'L',
  'A',
  'P',
  'nPortas',
  'esp',
  'espPorta',
  'espFundo',
] as const;

/** O que cada variável do módulo significa, para a tela de fórmulas. */
export const DESCRICAO_VARIAVEIS: Record<(typeof VARIAVEIS_DO_MODULO)[number], string> = {
  L: 'Largura do módulo',
  A: 'Altura do módulo',
  P: 'Profundidade do módulo',
  nPortas: 'Número de portas',
  esp: 'Espessura da chapa da caixa',
  espPorta: 'Espessura da chapa da porta',
  espFundo: 'Espessura da chapa do fundo',
};
