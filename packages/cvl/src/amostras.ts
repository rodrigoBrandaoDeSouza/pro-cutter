import { readdirSync, readFileSync } from 'node:fs';

/** Pasta com as amostras reais (fixtures de teste). */
export const PASTA_MODELOS = new URL('../../../.doc/models/', import.meta.url);

export interface Amostra {
  nome: string;
  conteudo: string;
}

/** Lê os .prog reais de .doc/models, em ordem de nome. Uso exclusivo em testes. */
export function amostrasProg(): Amostra[] {
  return readdirSync(PASTA_MODELOS)
    .filter((f) => f.endsWith('.prog'))
    .sort()
    .map((nome) => ({ nome, conteudo: readFileSync(new URL(nome, PASTA_MODELOS), 'latin1') }));
}
