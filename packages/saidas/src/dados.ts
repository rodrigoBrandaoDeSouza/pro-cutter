import type { ChapaPlano, Material, ParametrosCorte, Peca } from '@pro-cutter/core';

/** Tudo que as saídas precisam saber sobre um plano gravado. */
export interface DadosSaida {
  projeto: { id: string; nome: string; cliente: string; telefone?: string };
  plano: {
    versao: number;
    criadoEm: Date;
    parametros: ParametrosCorte;
    chapas: ChapaPlano[];
    pecas: Peca[];
    materiais: Material[];
  };
  /** Texto do atributo `material` no .prog, por id de material. */
  textoProg: Record<string, string>;
  nomes: { ambientes: Record<string, string>; modulos: Record<string, string> };
  etiqueta: { largura: number; altura: number };
  empresa?: string;
}
