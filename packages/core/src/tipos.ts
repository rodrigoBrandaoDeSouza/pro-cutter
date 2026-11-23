/** Medidas sempre em milímetros. Eixo X = comprimento da chapa; eixo Y = largura da chapa. */

export interface Material {
  id: string;
  descricao: string;
  espessura: number;
  chapa: { comprimento: number; largura: number };
  /** Com veio: a peça não pode girar; o comprimento da peça segue o eixo X (comprimento da chapa). */
  temVeio: boolean;
}

export type OrigemPeca = 'xml' | 'gerada' | 'manual';

/** Fita por borda, em mm de espessura (0 = sem fita). Ordem: [X superior, X inferior, Y esquerda, Y direita]. */
export type Fitas = [number, number, number, number];

export interface Peca {
  id: string;
  nome: string;
  /** Tipo de peça da marcenaria (base, lateral, sarrafo, porta, fundo, outro…). */
  tipo?: string;
  /** Medida no eixo X quando não girada. */
  comprimento: number;
  /** Medida no eixo Y quando não girada. */
  largura: number;
  espessura: number;
  quantidade: number;
  materialId: string;
  fita: Fitas;
  podeGirar: boolean;
  /** Pode ser cortada em sobra de outro material de mesma espessura. */
  materialAlternativo?: boolean;
  origem: OrigemPeca;
  refs?: { ambienteId?: string; moduloId?: string; promobId?: string };
}

export interface ParametrosCorte {
  /** Espessura da serra (kerf). */
  serra: number;
  /** Refilo aplicado em borda de fábrica da chapa. */
  refiloFabrica: number;
  /** Refilo aplicado em borda que já foi serrada. */
  refiloSerrado: number;
  /** Maior nível permitido na escada 1X→1Y→2X→2Y→3X… (3 = até 3X). */
  niveisMax: number;
  /** Menor sobra considerada aproveitável. */
  sobraMinima: { comprimento: number; largura: number };
}

export type Eixo = 'X' | 'Y';

/** Escada de níveis de corte guilhotina, igual à da CVL. */
export type Nivel = '1X' | '1Y' | '2X' | '2Y' | '3X' | '3Y' | '4X' | '4Y';

/**
 * Nó da árvore de cortes. Um nó é uma fatia do pai ao longo do eixo do seu nível,
 * com `medida` nesse eixo e o tamanho do pai no outro eixo.
 * Folha = peça (`pecaId`). Nó com filhos = subdividido no próximo nível da escada.
 */
export interface NoCorte {
  nivel: Nivel;
  medida: number;
  /** Refilo antes do primeiro filho (mm). Ausente/0 = sem refilo. */
  refiloFilhos?: number;
  filhos: NoCorte[];
  pecaId?: string;
}

export interface ChapaPlano {
  numero: number;
  materialId: string;
  comprimento: number;
  largura: number;
  /** Eixo do primeiro nível: 'X' começa em colunas (1X); 'Y' começa em faixas (1Y), com 1X implícito = chapa inteira. */
  inicio: Eixo;
  /** Refilo antes do primeiro nó de nível superior. */
  refilo?: number;
  nos: NoCorte[];
}

export interface Plano {
  chapas: ChapaPlano[];
}
