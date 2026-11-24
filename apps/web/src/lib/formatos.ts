/** Formatos numéricos do painel (pt-BR), compartilhados entre servidor e cliente. */
export type Formato = 'pct' | 'm2' | 'reais' | 'reaisCurto' | 'chapas' | 'inteiro';

const nf = (max: number, min = 0) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: max, minimumFractionDigits: min });

export function formatar(v: number, f: Formato): string {
  switch (f) {
    case 'pct':
      return `${nf(1).format(v * 100)}%`;
    case 'm2':
      return `${nf(v < 10 ? 1 : 0).format(v)} m²`;
    case 'reais':
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
      }).format(v);
    case 'reaisCurto':
      return Math.abs(v) >= 1000 ? `R$ ${nf(1).format(v / 1000)} mil` : `R$ ${nf(0).format(v)}`;
    case 'chapas':
      return `${nf(1).format(v)} ch.`;
    case 'inteiro':
      return nf(0).format(v);
  }
}
