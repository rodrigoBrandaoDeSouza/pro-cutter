import 'server-only';

/**
 * Limite simples de tentativas em memória (por processo): suficiente para um servidor único na marcenaria.
 * Com vários servidores, trocar por armazenamento compartilhado.
 */
const tentativas = new Map<string, { n: number; desde: number }>();

export function excedeuLimite(chave: string, max = 10, janelaMs = 15 * 60 * 1000): boolean {
  const agora = Date.now();
  const t = tentativas.get(chave);
  if (!t || agora - t.desde > janelaMs) {
    tentativas.set(chave, { n: 1, desde: agora });
    return false;
  }
  t.n++;
  return t.n > max;
}

export function zerarLimite(chave: string): void {
  tentativas.delete(chave);
}
