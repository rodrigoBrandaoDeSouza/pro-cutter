'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { json } from '@pro-cutter/db';
import { valoresDe } from '@pro-cutter/regras';
import { falha, sucesso, type Resultado } from '@/lib/acao';
import { lerConfiguracao } from '@/lib/server/config';
import { dbDoUsuario, exigirAdmin } from '@/lib/server/sessao';
import { erroDoBanco, validar } from '@/lib/server/validar';
import { STATUS } from '@/lib/status';

const esquemaProjeto = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do projeto'),
  clienteId: z.string().min(1, 'Escolha o cliente'),
  observacoes: z.string().trim().max(2000).default(''),
});

export async function criarProjeto(
  entrada: z.input<typeof esquemaProjeto>,
): Promise<Resultado<{ id: string }>> {
  const { usuario, db } = await dbDoUsuario();
  const v = validar(esquemaProjeto, entrada);
  if (!v.ok) return v;
  if (!(await db.cliente.findUnique({ where: { id: v.dados.clienteId } }))) {
    return falha('Cliente não encontrado.', { clienteId: 'Escolha o cliente' });
  }
  const cfg = await lerConfiguracao(db);
  const maquina = await db.maquina.findFirst({ where: { padrao: true } });

  try {
    // Regras e fórmulas são copiadas: mudanças futuras nas Configurações não alteram este projeto
    const projeto = await db.projeto.create({
      data: {
        ...v.dados,
        empresaId: usuario.empresaId,
        regras: json(valoresDe(cfg.regras)),
        tiposModulo: json(cfg.tiposModulo),
        maquinaId: maquina?.id ?? null,
      },
    });
    await db.historicoStatus.create({
      data: {
        empresaId: usuario.empresaId,
        projetoId: projeto.id,
        para: 'ORCAMENTO',
        usuarioId: usuario.id,
      },
    });
    revalidatePath('/projetos');
    return sucesso({ id: projeto.id }, 'Projeto criado.');
  } catch (e) {
    return erroDoBanco(e);
  }
}

export async function editarProjeto(
  entrada: z.input<typeof esquemaProjeto> & { id: string },
): Promise<Resultado> {
  const { db } = await dbDoUsuario();
  const v = validar(esquemaProjeto.extend({ id: z.string().min(1) }), entrada);
  if (!v.ok) return v;
  const { id, ...dados } = v.dados;
  try {
    await db.projeto.update({ where: { id }, data: dados });
  } catch (e) {
    return erroDoBanco(e);
  }
  revalidatePath(`/projetos/${id}`);
  revalidatePath('/projetos');
  return sucesso(null, 'Projeto atualizado.');
}

export async function mudarStatus(entrada: { id: string; status: string }): Promise<Resultado> {
  const { usuario, db } = await dbDoUsuario();
  const v = validar(z.object({ id: z.string().min(1), status: z.enum(STATUS) }), entrada);
  if (!v.ok) return v;
  const projeto = await db.projeto.findUnique({ where: { id: v.dados.id } });
  if (!projeto) return falha('Projeto não encontrado.');
  if (projeto.status === v.dados.status) return sucesso(null);

  await db.projeto.update({ where: { id: projeto.id }, data: { status: v.dados.status } });
  await db.historicoStatus.create({
    data: {
      empresaId: usuario.empresaId,
      projetoId: projeto.id,
      de: projeto.status,
      para: v.dados.status,
      usuarioId: usuario.id,
    },
  });
  revalidatePath(`/projetos/${projeto.id}`);
  revalidatePath('/projetos');
  return sucesso(null, 'Status atualizado.');
}

/** Excluir projeto apaga ambientes, peças e planos: só administradores. */
export async function excluirProjeto(id: string): Promise<Resultado> {
  await exigirAdmin();
  const { db } = await dbDoUsuario();
  try {
    await db.projeto.delete({ where: { id } });
  } catch (e) {
    return erroDoBanco(e);
  }
  revalidatePath('/projetos');
  redirect('/projetos');
}
