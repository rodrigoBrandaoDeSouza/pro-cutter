import type { Peca } from '@pro-cutter/core';

export interface ConsumoFita {
  materialId: string;
  /** Espessura da fita (mm). */
  espessura: number;
  metros: number;
}

/**
 * Metros de fita por material e espessura: bordas do comprimento (0, 1) contam o comprimento da peça,
 * bordas da largura (2, 3) contam a largura. A cor da fita segue o material da peça.
 */
export function consumoDeFita(pecas: Peca[]): ConsumoFita[] {
  const acc = new Map<string, ConsumoFita>();
  for (const p of pecas) {
    p.fita.forEach((esp, i) => {
      if (esp <= 0) return;
      const lado = i < 2 ? p.comprimento : p.largura;
      const chave = `${p.materialId}|${esp}`;
      const c = acc.get(chave) ?? { materialId: p.materialId, espessura: esp, metros: 0 };
      c.metros += (lado * p.quantidade) / 1000;
      acc.set(chave, c);
    });
  }
  return [...acc.values()].sort(
    (a, b) => a.materialId.localeCompare(b.materialId) || a.espessura - b.espessura,
  );
}
