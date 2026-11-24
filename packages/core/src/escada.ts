import type { Eixo, Nivel } from './tipos.ts';

export const ESCADA: readonly Nivel[] = ['1X', '1Y', '2X', '2Y', '3X', '3Y', '4X', '4Y'];

export function eixoDo(nivel: Nivel): Eixo {
  return nivel.endsWith('X') ? 'X' : 'Y';
}

export function proximoNivel(nivel: Nivel): Nivel | undefined {
  return ESCADA[ESCADA.indexOf(nivel) + 1];
}

export function nivelInicial(inicio: Eixo): Nivel {
  return inicio === 'X' ? '1X' : '1Y';
}

/** Índice do nível na escada (1X=0, 1Y=1, 2X=2…). */
export function indiceNivel(nivel: Nivel): number {
  return ESCADA.indexOf(nivel);
}

/** Último nível permitido para `niveisMax` (3 → '3X'). */
export function nivelMaximo(niveisMax: number): Nivel {
  const n = ESCADA.find((x) => x === `${niveisMax}X`);
  if (!n) throw new Error(`niveisMax inválido: ${niveisMax}`);
  return n;
}
