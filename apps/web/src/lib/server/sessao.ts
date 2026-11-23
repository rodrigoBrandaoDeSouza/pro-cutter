import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { daEmpresa, sessaoAtual, type UsuarioSessao } from '@pro-cutter/db';
import { prisma } from './db';

export const COOKIE_SESSAO = 'pc_sessao';

/** O banco controla a validade (30 dias renováveis); o cookie só precisa durar mais que isso. */
export const OPCOES_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 400 * 24 * 60 * 60,
};

/** Usuário logado (uma consulta por requisição), ou null. */
export const obterUsuario = cache(async (): Promise<UsuarioSessao | null> => {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value;
  const sessao = await sessaoAtual(prisma, token);
  return sessao?.usuario ?? null;
});

/** Para páginas e ações: exige login; sem sessão válida, vai para a tela de entrada. */
export async function exigirUsuario(): Promise<UsuarioSessao> {
  const usuario = await obterUsuario();
  if (!usuario) redirect('/entrar');
  return usuario;
}

/** Para páginas e ações de administração. */
export async function exigirAdmin(): Promise<UsuarioSessao> {
  const usuario = await exigirUsuario();
  if (usuario.papel !== 'ADMIN') redirect('/sem-permissao');
  return usuario;
}

/** Acesso ao banco restrito à empresa do usuário logado. */
export async function dbDoUsuario() {
  const usuario = await exigirUsuario();
  return { usuario, db: daEmpresa(prisma, usuario.empresaId) };
}
