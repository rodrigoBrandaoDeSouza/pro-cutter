'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { falha, sucesso, type Resultado } from '@/lib/acao';
import { dbDoUsuario } from '@/lib/server/sessao';
import { erroDoBanco, validar } from '@/lib/server/validar';
import { digitosTelefone } from '@/lib/telefone';

const esquema = z.object({
  id: z.string().optional(),
  nome: z.string().trim().min(2, 'Informe o nome do cliente'),
  telefone: z
    .string()
    .transform(digitosTelefone)
    .refine((t) => t === '' || t.length >= 10, 'Telefone com DDD: (45) 99999-9999'),
});

export interface ClienteSalvo {
  id: string;
  nome: string;
}

export async function salvarCliente(
  entrada: z.input<typeof esquema>,
): Promise<Resultado<ClienteSalvo>> {
  const { usuario, db } = await dbDoUsuario();
  const v = validar(esquema, entrada);
  if (!v.ok) return v;
  const { id, ...dados } = v.dados;
  try {
    const c = id
      ? await db.cliente.update({ where: { id }, data: dados })
      : await db.cliente.create({ data: { ...dados, empresaId: usuario.empresaId } });
    revalidatePath('/clientes');
    revalidatePath('/projetos');
    return sucesso(
      { id: c.id, nome: c.nome },
      id ? 'Cliente atualizado.' : `Cliente ${c.nome} cadastrado.`,
    );
  } catch (e) {
    return erroDoBanco(e);
  }
}

export async function excluirCliente(id: string): Promise<Resultado> {
  const { db } = await dbDoUsuario();
  const projetos = await db.projeto.count({ where: { clienteId: id } });
  if (projetos > 0) {
    return falha(`Este cliente tem ${projetos} projeto(s). Exclua ou transfira os projetos antes.`);
  }
  try {
    await db.cliente.delete({ where: { id } });
  } catch (e) {
    return erroDoBanco(e);
  }
  revalidatePath('/clientes');
  return sucesso(null, 'Cliente excluído.');
}
