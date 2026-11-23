import 'server-only';
import type { z } from 'zod';
import { falha, type Resultado } from '@/lib/acao';

/** Valida a entrada de uma ação; em caso de erro devolve as mensagens por campo. */
export function validar<S extends z.ZodType>(
  esquema: S,
  entrada: unknown,
): { ok: true; dados: z.infer<S> } | Resultado<never> {
  const r = esquema.safeParse(entrada);
  if (r.success) return { ok: true, dados: r.data };
  const campos: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const chave = issue.path.join('.') || '_';
    campos[chave] ??= issue.message;
  }
  return falha('Confira os campos destacados.', campos);
}

/** Traduz erros conhecidos do banco para mensagens de usuário. */
export function erroDoBanco(e: unknown, unicos: Record<string, string> = {}): Resultado<never> {
  const err = e as { code?: string; meta?: { target?: string[] | string } };
  if (err.code === 'P2002') {
    const alvo = Array.isArray(err.meta?.target)
      ? err.meta.target.join(',')
      : String(err.meta?.target ?? '');
    const campo = Object.keys(unicos).find((k) => alvo.includes(k));
    if (campo) return falha(unicos[campo]!, { [campo]: unicos[campo]! });
    return falha('Já existe um registro com esses dados.');
  }
  if (err.code === 'P2025')
    return falha('Registro não encontrado (talvez já tenha sido removido).');
  if (err.code === 'P2003')
    return falha('Não é possível remover: há outros registros ligados a este.');
  console.error(e);
  return falha('Algo deu errado. Tente de novo.');
}
