import { posicionar, type Geometria, type OpcoesGeometria } from './geometria.ts';
import type { Plano } from './tipos.ts';

export interface PecaNumerada {
  /** Número da etiqueta (1, 2, 3…), único no plano. */
  numero: number;
  chapa: number;
  /** Índice em geometria.pecas da chapa. */
  indice: number;
  pecaId: string;
}

/**
 * Numeração oficial das peças de um plano: chapa a chapa, na ordem em que aparecem na geometria.
 * É a mesma no visualizador, no desenho em PDF e nas etiquetas.
 */
export function numerarPecas(
  plano: Plano,
  op: OpcoesGeometria,
): { geometrias: Geometria[]; pecas: PecaNumerada[] } {
  const geometrias = plano.chapas.map((c) => posicionar(c, op));
  const pecas: PecaNumerada[] = [];
  geometrias.forEach((g, k) =>
    g.pecas.forEach((pp, indice) =>
      pecas.push({
        numero: pecas.length + 1,
        chapa: plano.chapas[k]!.numero,
        indice,
        pecaId: pp.pecaId,
      }),
    ),
  );
  return { geometrias, pecas };
}
