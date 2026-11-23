import { eixoDo } from './escada.ts';
import type { ChapaPlano, Eixo, Nivel, NoCorte } from './tipos.ts';

export interface PecaPosicionada {
  pecaId: string;
  x: number;
  y: number;
  /** Tamanho no eixo X. */
  c: number;
  /** Tamanho no eixo Y. */
  l: number;
}

export interface CortePosicionado {
  nivel: Nivel;
  /** Eixo em que a posição é medida: 'X' = linha vertical em x=pos; 'Y' = linha horizontal em y=pos. */
  eixo: Eixo;
  pos: number;
  /** Extensão da linha no outro eixo. */
  de: number;
  ate: number;
  refilo: boolean;
}

export interface Sobra {
  x: number;
  y: number;
  c: number;
  l: number;
  util: boolean;
}

export interface Geometria {
  pecas: PecaPosicionada[];
  /** Na ordem de execução na seccionadora. */
  cortes: CortePosicionado[];
  sobras: Sobra[];
}

export interface OpcoesGeometria {
  serra: number;
  sobraMinima: { comprimento: number; largura: number };
}

interface Regiao {
  x: number;
  y: number;
  c: number;
  l: number;
}

/**
 * Deriva a geometria (posições, linhas de corte e sobras) de uma chapa a partir da árvore de cortes.
 * A árvore é a fonte da verdade; esta função não valida se as medidas cabem (ver `validarPlano`).
 */
export function posicionar(chapa: ChapaPlano, op: OpcoesGeometria): Geometria {
  const g: Geometria = { pecas: [], cortes: [], sobras: [] };
  const regiao = { x: 0, y: 0, c: chapa.comprimento, l: chapa.largura };
  subdividir(regiao, chapa.nos, chapa.refilo ?? 0, op, g);
  return g;
}

function subdividir(
  r: Regiao,
  nos: NoCorte[],
  refilo: number,
  op: OpcoesGeometria,
  g: Geometria,
): void {
  const primeiro = nos[0];
  if (!primeiro) return;
  const nivel = primeiro.nivel;
  const eixo = eixoDo(nivel);
  const inicio = eixo === 'X' ? r.x : r.y;
  const limite = inicio + (eixo === 'X' ? r.c : r.l);
  const [de, ate] = eixo === 'X' ? [r.y, r.y + r.l] : [r.x, r.x + r.c];

  let p = inicio;
  if (refilo > 0) {
    g.cortes.push({ nivel, eixo, pos: p + refilo, de, ate, refilo: true });
    p += refilo + op.serra;
  }

  for (const no of nos) {
    const fim = p + no.medida;
    if (fim < limite) g.cortes.push({ nivel: no.nivel, eixo, pos: fim, de, ate, refilo: false });

    const filho: Regiao =
      eixo === 'X'
        ? { x: p, y: r.y, c: no.medida, l: r.l }
        : { x: r.x, y: p, c: r.c, l: no.medida };

    if (no.filhos.length > 0) subdividir(filho, no.filhos, no.refiloFilhos ?? 0, op, g);
    else if (no.pecaId !== undefined) g.pecas.push({ pecaId: no.pecaId, ...filho });

    p = fim + op.serra;
  }

  if (p < limite) {
    const s: Regiao =
      eixo === 'X'
        ? { x: p, y: r.y, c: limite - p, l: r.l }
        : { x: r.x, y: p, c: r.c, l: limite - p };
    g.sobras.push({ ...s, util: ehUtil(s, op.sobraMinima) });
  }
}

function ehUtil(s: Regiao, min: { comprimento: number; largura: number }): boolean {
  return (
    (s.c >= min.comprimento && s.l >= min.largura) || (s.c >= min.largura && s.l >= min.comprimento)
  );
}
