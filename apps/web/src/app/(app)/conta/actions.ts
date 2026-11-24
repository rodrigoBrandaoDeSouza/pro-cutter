'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { entrar, trocarSenha } from '@pro-cutter/db';
import { falha, sucesso, type Resultado } from '@/lib/acao';
import { prisma } from '@/lib/server/db';
import { COOKIE_SESSAO, exigirUsuario, opcoesCookie } from '@/lib/server/sessao';
import { validar } from '@/lib/server/validar';

const esquema = z
  .object({
    atual: z.string().min(1, 'Informe a senha atual'),
    nova: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres'),
    confirmacao: z.string(),
  })
  .refine((d) => d.nova === d.confirmacao, {
    path: ['confirmacao'],
    message: 'As senhas não conferem',
  });

/** Troca a própria senha. Encerra as outras sessões e mantém a pessoa logada neste aparelho. */
export async function trocarMinhaSenha(entrada: z.input<typeof esquema>): Promise<Resultado> {
  const usuario = await exigirUsuario();
  const v = validar(esquema, entrada);
  if (!v.ok) return v;

  const r = await trocarSenha(prisma, usuario.id, v.dados.atual, v.dados.nova);
  if (!r.ok) return falha(r.erro, { [r.campo]: r.erro });

  const nova = await entrar(prisma, usuario.email, v.dados.nova);
  if (nova) (await cookies()).set(COOKIE_SESSAO, nova.token, await opcoesCookie());
  revalidatePath('/', 'layout');
  return sucesso(null, 'Senha trocada. Outros aparelhos precisarão entrar de novo.');
}
