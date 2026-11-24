'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { daEmpresa, encerrarSessoes, hashSenha } from '@pro-cutter/db';
import { falha, sucesso, type Resultado } from '@/lib/acao';
import { prisma } from '@/lib/server/db';
import { exigirAdmin } from '@/lib/server/sessao';
import { erroDoBanco, validar } from '@/lib/server/validar';

const SENHA = z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres');
const PAPEL = z.enum(['ADMIN', 'USUARIO']);

const esquemaNovo = z.object({
  nome: z.string().trim().min(2, 'Informe o nome'),
  email: z.email('E-mail inválido').trim().toLowerCase(),
  senha: SENHA,
  papel: PAPEL,
});

const esquemaEdicao = z.object({
  id: z.string().min(1),
  nome: z.string().trim().min(2, 'Informe o nome'),
  papel: PAPEL,
  ativo: z.boolean(),
  novaSenha: z.union([SENHA, z.literal('')]).optional(),
});

export async function criarUsuario(entrada: z.input<typeof esquemaNovo>): Promise<Resultado> {
  const admin = await exigirAdmin();
  const v = validar(esquemaNovo, entrada);
  if (!v.ok) return v;
  const { senha, ...dados } = v.dados;

  if (await prisma.usuario.findUnique({ where: { email: dados.email } })) {
    return falha('Já existe um usuário com este e-mail.', { email: 'E-mail já cadastrado' });
  }
  try {
    await daEmpresa(prisma, admin.empresaId).usuario.create({
      data: {
        ...dados,
        empresaId: admin.empresaId,
        senhaHash: await hashSenha(senha),
        // senha definida pelo admin: a pessoa troca no primeiro acesso
        deveTrocarSenha: true,
      },
    });
  } catch (e) {
    return erroDoBanco(e);
  }
  revalidatePath('/usuarios');
  return sucesso(null, `Usuário ${dados.nome} criado.`);
}

export async function editarUsuario(entrada: z.input<typeof esquemaEdicao>): Promise<Resultado> {
  const admin = await exigirAdmin();
  const v = validar(esquemaEdicao, entrada);
  if (!v.ok) return v;
  const { id, novaSenha, ...dados } = v.dados;
  const db = daEmpresa(prisma, admin.empresaId);

  const atual = await db.usuario.findUnique({ where: { id } });
  if (!atual) return falha('Usuário não encontrado.');

  if (id === admin.id && (dados.papel !== 'ADMIN' || !dados.ativo)) {
    return falha('Você não pode tirar seu próprio acesso de administrador nem se desativar.');
  }
  const deixaDeSerAdminAtivo =
    atual.papel === 'ADMIN' && atual.ativo && (dados.papel !== 'ADMIN' || !dados.ativo);
  if (deixaDeSerAdminAtivo) {
    const outros = await db.usuario.count({
      where: { papel: 'ADMIN', ativo: true, id: { not: id } },
    });
    if (outros === 0) return falha('É preciso manter pelo menos um administrador ativo.');
  }

  try {
    await db.usuario.update({
      where: { id },
      data: {
        ...dados,
        ...(novaSenha
          ? { senhaHash: await hashSenha(novaSenha), deveTrocarSenha: id !== admin.id }
          : {}),
      },
    });
  } catch (e) {
    return erroDoBanco(e);
  }
  // Troca de senha ou desativação derruba as sessões abertas do usuário
  if (novaSenha || !dados.ativo) await encerrarSessoes(prisma, id);

  revalidatePath('/usuarios');
  return sucesso(null, 'Usuário atualizado.');
}
