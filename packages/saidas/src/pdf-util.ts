import { rgb, StandardFonts, type PDFDocument, type PDFFont, type RGB } from 'pdf-lib';

/** 1 mm em pontos PDF. */
export const MM = 72 / 25.4;

export const COR = {
  texto: rgb(0.13, 0.12, 0.11),
  suave: rgb(0.45, 0.43, 0.41),
  borda: rgb(0.78, 0.76, 0.74),
  chapa: rgb(0.93, 0.92, 0.9),
  peca: rgb(1, 1, 1),
  fita: rgb(0.78, 0.33, 0.07),
  sobra: rgb(0.85, 0.94, 0.86),
  perda: rgb(0.86, 0.85, 0.83),
  nivel1: rgb(0.15, 0.15, 0.15),
  nivel2: rgb(0.0, 0.47, 0.75),
  nivel3: rgb(0.46, 0.25, 0.8),
  destaque: rgb(0.71, 0.27, 0.04),
} satisfies Record<string, RGB>;

export interface Fontes {
  normal: PDFFont;
  negrito: PDFFont;
}

export async function carregarFontes(doc: PDFDocument): Promise<Fontes> {
  return {
    normal: await doc.embedFont(StandardFonts.Helvetica),
    negrito: await doc.embedFont(StandardFonts.HelveticaBold),
  };
}

const TROCAS: Record<string, string> = {
  '≈': '~',
  '→': '->',
  '—': '-',
  '–': '-',
  '“': '"',
  '”': '"',
  '’': "'",
};

/** Troca caracteres que a fonte padrão (WinAnsi) não tem; o resto vira "?". */
export function textoSeguro(fonte: PDFFont, s: string): string {
  let r = '';
  for (const ch of s) {
    const c = TROCAS[ch] ?? ch;
    try {
      fonte.encodeText(c);
      r += c;
    } catch {
      r += '?';
    }
  }
  return r;
}

/** Corta o texto com "…" para caber na largura (em pontos). */
export function caber(fonte: PDFFont, s: string, tamanho: number, largura: number): string {
  let t = textoSeguro(fonte, s);
  if (fonte.widthOfTextAtSize(t, tamanho) <= largura) return t;
  while (t.length > 1 && fonte.widthOfTextAtSize(`${t}...`, tamanho) > largura) t = t.slice(0, -1);
  return `${t}...`;
}

/** Número em pt-BR (vírgula decimal, ponto de milhar). */
export function num(v: number, casas = 1): string {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: casas });
}

export function porcentagem(v: number): string {
  return `${num(v * 100)}%`;
}
