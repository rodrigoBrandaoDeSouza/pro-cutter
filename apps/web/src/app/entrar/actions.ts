'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { entrar, sair } from '@pro-cutter/db';
import { prisma } from '@/lib/server/db';
import { excedeuLimite, zerarLimite } from '@/lib/server/limite';
import { COOKIE_SESSAO, opcoesCookie } from '@/lib/server/sessao';

export interface EstadoEntrar {
  erro?: string;
  email?: string;
}

const esquema = z.object({
  email: z.email('Informe um e-mail válido'),
  senha: z.string().min(1, 'Informe a senha'),
  de: z.string().optional(),
});

/** Só aceita caminhos internos para o redirecionamento pós-login. */
function destinoSeguro(de: string | undefined): string {
  return de && de.startsWith('/') && !de.startsWith('//') && !de.startsWith('/\\')
    ? de
    : '/projetos';
}

export async function entrarAction(_: EstadoEntrar, form: FormData): Promise<EstadoEntrar> {
  const dados = esquema.safeParse(Object.fromEntries(form));
  const email = String(form.get('email') ?? '');
  if (!dados.success) return { erro: dados.error.issues[0]?.message, email };

  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const chave = `${ip}|${dados.data.email.toLowerCase()}`;
  if (excedeuLimite(chave)) {
    return { erro: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.', email };
  }

  const r = await entrar(prisma, dados.data.email, dados.data.senha);
  if (!r) return { erro: 'E-mail ou senha incorretos.', email };

  zerarLimite(chave);
  (await cookies()).set(COOKIE_SESSAO, r.token, await opcoesCookie());
  redirect(destinoSeguro(dados.data.de));
}

export async function sairAction(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_SESSAO)?.value;
  if (token) await sair(prisma, token);
  jar.delete(COOKIE_SESSAO);
  redirect('/entrar');
}
