import { createHash, randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import type { PrismaClient } from './cliente.ts';

const DURACAO_SESSAO_MS = 30 * 24 * 60 * 60 * 1000;
const RENOVAR_ABAIXO_DE_MS = 15 * 24 * 60 * 60 * 1000;
const TAMANHO_MINIMO_SENHA = 8;

export function validarSenhaNova(senha: string): string | null {
  if (senha.length < TAMANHO_MINIMO_SENHA)
    return `A senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres`;
  return null;
}

export function hashSenha(senha: string): Promise<string> {
  // @node-rs/argon2 usa Argon2id por padrão
  return hash(senha);
}

export async function verificarSenha(senhaHash: string, senha: string): Promise<boolean> {
  try {
    return await verify(senhaHash, senha);
  } catch {
    return false;
  }
}

/** O banco guarda só o hash do token; quem tem acesso ao banco não consegue usar as sessões. */
function idDaSessao(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Hash fixo usado quando o e-mail não existe, para o tempo de resposta não revelar quais e-mails existem.
let hashFalso: Promise<string> | undefined;

export interface UsuarioSessao {
  id: string;
  empresaId: string;
  nome: string;
  email: string;
  papel: 'ADMIN' | 'USUARIO';
  /** A senha foi definida por outra pessoa: o app pede para trocar. */
  deveTrocarSenha: boolean;
}

/** Retorna o token da nova sessão (para o cookie) ou null se e-mail/senha não conferem. */
export async function entrar(
  prisma: PrismaClient,
  email: string,
  senha: string,
): Promise<{ token: string; expiraEm: Date; usuario: UsuarioSessao } | null> {
  const usuario = await prisma.usuario.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!usuario || !usuario.ativo) {
    hashFalso ??= hashSenha(randomBytes(16).toString('hex'));
    await verificarSenha(await hashFalso, senha);
    return null;
  }
  if (!(await verificarSenha(usuario.senhaHash, senha))) return null;

  const token = randomBytes(32).toString('base64url');
  const expiraEm = new Date(Date.now() + DURACAO_SESSAO_MS);
  await prisma.sessao.create({ data: { id: idDaSessao(token), usuarioId: usuario.id, expiraEm } });
  return { token, expiraEm, usuario: paraSessao(usuario) };
}

/** Valida o token do cookie. Renova a validade quando faltam menos de 15 dias. */
export async function sessaoAtual(
  prisma: PrismaClient,
  token: string | undefined,
): Promise<{ usuario: UsuarioSessao; expiraEm: Date } | null> {
  if (!token) return null;
  const sessao = await prisma.sessao.findUnique({
    where: { id: idDaSessao(token) },
    include: { usuario: true },
  });
  if (!sessao) return null;
  if (sessao.expiraEm.getTime() <= Date.now() || !sessao.usuario.ativo) {
    await prisma.sessao.delete({ where: { id: sessao.id } }).catch(() => undefined);
    return null;
  }
  let expiraEm = sessao.expiraEm;
  if (expiraEm.getTime() - Date.now() < RENOVAR_ABAIXO_DE_MS) {
    expiraEm = new Date(Date.now() + DURACAO_SESSAO_MS);
    await prisma.sessao.update({ where: { id: sessao.id }, data: { expiraEm } });
  }
  return { usuario: paraSessao(sessao.usuario), expiraEm };
}

export async function sair(prisma: PrismaClient, token: string): Promise<void> {
  await prisma.sessao.deleteMany({ where: { id: idDaSessao(token) } });
}

/** Encerra todas as sessões do usuário (ex.: troca de senha, desativação). */
export async function encerrarSessoes(prisma: PrismaClient, usuarioId: string): Promise<void> {
  await prisma.sessao.deleteMany({ where: { usuarioId } });
}

function paraSessao(u: {
  id: string;
  empresaId: string;
  nome: string;
  email: string;
  papel: 'ADMIN' | 'USUARIO';
  deveTrocarSenha: boolean;
}): UsuarioSessao {
  return {
    id: u.id,
    empresaId: u.empresaId,
    nome: u.nome,
    email: u.email,
    papel: u.papel,
    deveTrocarSenha: u.deveTrocarSenha,
  };
}

/** Troca a própria senha: confere a atual, grava a nova e encerra todas as sessões do usuário. */
export async function trocarSenha(
  prisma: PrismaClient,
  usuarioId: string,
  atual: string,
  nova: string,
): Promise<{ ok: true } | { ok: false; campo: 'atual' | 'nova'; erro: string }> {
  const u = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!u || !(await verificarSenha(u.senhaHash, atual))) {
    return { ok: false, campo: 'atual', erro: 'Senha atual incorreta' };
  }
  const erro = validarSenhaNova(nova);
  if (erro) return { ok: false, campo: 'nova', erro };
  if (await verificarSenha(u.senhaHash, nova)) {
    return { ok: false, campo: 'nova', erro: 'A nova senha precisa ser diferente da atual' };
  }
  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { senhaHash: await hashSenha(nova), deveTrocarSenha: false },
  });
  await encerrarSessoes(prisma, usuarioId);
  return { ok: true };
}
