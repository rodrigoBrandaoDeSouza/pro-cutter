'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { daEmpresa } from '@pro-cutter/db';
import { sucesso, type Resultado } from '@/lib/acao';
import { prisma } from '@/lib/server/db';
import { exigirAdmin } from '@/lib/server/sessao';
import { validar } from '@/lib/server/validar';

const esquema = z.object({
  /** Em porcentagem, como a pessoa digita (ex.: 70). */
  percentual: z.coerce
    .number({ error: 'Informe um número' })
    .min(30, 'Mínimo 30%')
    .max(95, 'Máximo 95%'),
});

export async function salvarReferencia(entrada: z.input<typeof esquema>): Promise<Resultado> {
  const admin = await exigirAdmin();
  const v = validar(esquema, entrada);
  if (!v.ok) return v;
  const db = daEmpresa(prisma, admin.empresaId);
  await db.configuracao.updateMany({
    data: { aproveitamentoReferencia: v.dados.percentual / 100 },
  });
  revalidatePath('/painel');
  return sucesso(null, 'Referência salva.');
}
