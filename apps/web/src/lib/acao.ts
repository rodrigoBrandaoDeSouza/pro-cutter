/** Resultado padrão das ações do servidor (serializável para o cliente). */
export type Resultado<T = null> =
  | { ok: true; dados: T; mensagem?: string }
  | { ok: false; erro: string; campos?: Record<string, string> };

export function sucesso<T>(dados: T, mensagem?: string): Resultado<T> {
  return { ok: true, dados, ...(mensagem ? { mensagem } : {}) };
}

export function falha(erro: string, campos?: Record<string, string>): Resultado<never> {
  return { ok: false, erro, ...(campos ? { campos } : {}) };
}
