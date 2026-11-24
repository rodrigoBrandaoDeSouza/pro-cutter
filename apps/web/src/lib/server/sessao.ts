import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { daEmpresa, sessaoAtual, type UsuarioSessao } from '@pro-cutter/db';
import { prisma } from './db';

export const COOKIE_SESSAO = 'pc_sessao';

/**
 * Opções do cookie de sessão. O banco controla a validade (30 dias renováveis); o cookie só precisa
 * durar mais que isso. `secure` só quando o acesso chega por HTTPS: na marcenaria é comum usar
 * http://ip-do-servidor na rede local, e um cookie `secure` seria descartado pelo navegador
 * (o login falharia sem erro). COOKIE_SEGURO=1 ou 0 força o comportamento.
 */
export async function opcoesCookie() {
  const forcado = process.env.COOKIE_SEGURO;
  let secure: boolean;
  if (forcado === '1' || forcado === '0') {
    secure = forcado === '1';
  } else {
    const h = await headers();
    const proto =
      h.get('x-forwarded-proto')?.split(',')[0]?.trim() ??
      new URL(h.get('origin') ?? 'http://x').protocol.replace(':', '');
    secure = proto === 'https';
  }
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 400 * 24 * 60 * 60,
  };
}

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
