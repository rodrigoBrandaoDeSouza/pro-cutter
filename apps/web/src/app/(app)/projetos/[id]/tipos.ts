/** Dados serializáveis que a página do projeto entrega às abas (cliente). */

export interface MaterialVM {
  id: string;
  descricao: string;
  espessura: number;
  temVeio: boolean;
  chapaComprimento: number;
  chapaLargura: number;
  ativo: boolean;
}

export interface ModuloVM {
  id: string;
  ambienteId: string;
  nome: string;
  tipoId: string;
  L: number;
  A: number;
  P: number;
  nPortas: number;
  materialCaixaId: string;
  materialPortaId: string | null;
  materialFundoId: string | null;
  regras: Record<string, number>;
  extras: Record<string, number>;
}

export type OrigemVM = 'XML' | 'GERADA' | 'MANUAL';

export interface PecaVM {
  id: string;
  ambienteId: string;
  moduloId: string | null;
  origem: OrigemVM;
  nome: string;
  tipo: string;
  comprimento: number;
  largura: number;
  espessura: number;
  quantidade: number;
  materialId: string;
  fita: [number, number, number, number];
  podeGirar: boolean;
  materialAlternativo: boolean;
}

export interface AmbienteVM {
  id: string;
  nome: string;
  importadoEm: string | null;
  temXml: boolean;
}

export interface ParametroVM {
  chave: string;
  rotulo: string;
  unidade?: string;
  grupo?: string;
  /** Valor nas Configurações (padrão da marcenaria). */
  padrao?: number;
}
