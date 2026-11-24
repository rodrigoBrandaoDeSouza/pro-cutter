'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { validarPlano, type ChapaPlano, type ParametrosCorte } from '@pro-cutter/core';
import { json } from '@pro-cutter/db';
import { otimizarProjeto } from '@pro-cutter/otimizador';
import { falha, sucesso, type Resultado } from '@/lib/acao';
import { materialDoBanco, pecaDoBanco } from '@/lib/server/projeto';
import { dbDoUsuario } from '@/lib/server/sessao';
import { validar } from '@/lib/server/validar';

/** Limite de tempo da busca por material; a cozinha de exemplo resolve em < 0,1 s. */
const TEMPO_POR_MATERIAL_MS = 2500;

export interface ParametrosPlano extends ParametrosCorte {
  /** Peças fixadas: número GLOBAL da chapa (como aparece na tela). */
  fixadas: { pecaId: string; chapa: number }[];
}

const esquema = z.object({
  projetoId: z.string().min(1),
  fixadas: z
    .array(z.object({ pecaId: z.string().min(1), chapa: z.number().int().min(1) }))
    .default([]),
});

export async function otimizarPlano(
  entrada: z.input<typeof esquema>,
): Promise<Resultado<{ versao: number }>> {
  const { usuario, db } = await dbDoUsuario();
  const v = validar(esquema, entrada);
  if (!v.ok) return v;
  const { projetoId, fixadas } = v.dados;

  const projeto = await db.projeto.findUnique({
    where: { id: projetoId },
    include: { maquina: true, planos: { where: { status: 'ATUAL' }, take: 1 } },
  });
  if (!projeto) return falha('Projeto não encontrado.');
  const maquina = projeto.maquina ?? (await db.maquina.findFirst({ where: { padrao: true } }));
  if (!maquina) return falha('Cadastre a máquina em Configurações antes de otimizar.');

  const pecas = (
    await db.peca.findMany({ where: { ambiente: { projetoId } }, orderBy: { ordem: 'asc' } })
  ).map(pecaDoBanco);
  if (pecas.length === 0) return falha('O projeto ainda não tem peças.');
  const ids = [...new Set(pecas.map((p) => p.materialId))];
  const materiais = (await db.material.findMany({ where: { id: { in: ids } } })).map(
    materialDoBanco,
  );

  const params: ParametrosCorte = {
    serra: maquina.serra,
    refiloFabrica: maquina.refiloFabrica,
    refiloSerrado: maquina.refiloSerrado,
    niveisMax: maquina.niveisMax,
    sobraMinima: { comprimento: maquina.sobraMinComp, largura: maquina.sobraMinLarg },
  };

  // A tela mostra o número global da chapa; o otimizador espera a posição dentro do material
  const anterior = projeto.planos[0]?.chapas as ChapaPlano[] | undefined;
  const fixadasPorMaterial = fixadas.flatMap((f) => {
    const chapa = anterior?.find((c) => c.numero === f.chapa);
    if (!chapa) return [];
    const posicao = anterior!.filter(
      (c) => c.materialId === chapa.materialId && c.numero <= f.chapa,
    ).length;
    return pecas.some((p) => p.id === f.pecaId) ? [{ pecaId: f.pecaId, chapa: posicao }] : [];
  });

  let plano;
  try {
    plano = otimizarProjeto(pecas, materiais, params, {
      semente: 1,
      iteracoes: 300,
      tempoMs: TEMPO_POR_MATERIAL_MS,
      fixadas: fixadasPorMaterial,
    });
  } catch (e) {
    return falha(traduzir((e as Error).message, pecas));
  }

  // O juiz: plano inválido nunca é gravado
  const erros = validarPlano(plano, { pecas, materiais, params });
  if (erros.length) {
    console.error('Plano inválido', erros);
    return falha(`O otimizador gerou um plano inválido (${erros[0]!.mensagem}). Avise o suporte.`);
  }

  const versao =
    ((await db.planoDeCorte.aggregate({ where: { projetoId }, _max: { versao: true } }))._max
      .versao ?? 0) + 1;
  await db.planoDeCorte.updateMany({
    where: { projetoId, status: 'ATUAL' },
    data: { status: 'DESATUALIZADO' },
  });
  await db.planoDeCorte.create({
    data: {
      empresaId: usuario.empresaId,
      projetoId,
      versao,
      parametros: json({ ...params, fixadas } satisfies ParametrosPlano),
      chapas: json(plano.chapas),
      pecas: json(pecas),
      materiais: json(materiais),
      criadoPorId: usuario.id,
    },
  });
  revalidatePath(`/projetos/${projetoId}`);
  return sucesso({ versao }, `Plano otimizado: ${plano.chapas.length} chapa(s).`);
}

/** Mensagens do otimizador com o nome da peça no lugar do id. */
function traduzir(msg: string, pecas: { id: string; nome: string }[]): string {
  let r = msg;
  for (const p of pecas) r = r.replaceAll(`Peça ${p.id}`, `A peça “${p.nome}”`);
  return r.replace(/não cabe na chapa/, 'não cabe na chapa do material');
}
