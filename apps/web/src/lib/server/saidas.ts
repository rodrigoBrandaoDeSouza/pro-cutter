import 'server-only';
import type { ChapaPlano, Material, ParametrosCorte, Peca } from '@pro-cutter/core';
import type { PrismaDaEmpresa } from '@pro-cutter/db';
import type { DadosSaida } from '@pro-cutter/saidas';
import { lerConfiguracao } from './config';

/** Monta os dados de saída de uma versão de plano gravada (ou null se não existir nesta empresa). */
export async function dadosDoPlano(
  db: PrismaDaEmpresa,
  projetoId: string,
  versao: number,
): Promise<(DadosSaida & { atual: boolean }) | null> {
  const plano = await db.planoDeCorte.findFirst({
    where: { projetoId, versao },
    include: { projeto: { include: { cliente: true, ambientes: { include: { modulos: true } } } } },
  });
  if (!plano) return null;

  const materiais = plano.materiais as unknown as Material[];
  const [cfg, cadastrados] = await Promise.all([
    lerConfiguracao(db),
    db.material.findMany({ where: { id: { in: materiais.map((m) => m.id) } } }),
  ]);
  const { projeto } = plano;

  return {
    atual: plano.status === 'ATUAL',
    projeto: {
      id: projeto.id,
      nome: projeto.nome,
      cliente: projeto.cliente.nome,
      telefone: projeto.cliente.telefone,
    },
    plano: {
      versao: plano.versao,
      criadoEm: plano.criadoEm,
      parametros: plano.parametros as unknown as ParametrosCorte,
      chapas: plano.chapas as unknown as ChapaPlano[],
      pecas: plano.pecas as unknown as Peca[],
      materiais,
    },
    textoProg: Object.fromEntries(
      cadastrados.filter((m) => m.textoProg).map((m) => [m.id, m.textoProg!]),
    ),
    nomes: {
      ambientes: Object.fromEntries(projeto.ambientes.map((a) => [a.id, a.nome])),
      modulos: Object.fromEntries(
        projeto.ambientes.flatMap((a) => a.modulos.map((m) => [m.id, m.nome])),
      ),
    },
    etiqueta: cfg.etiqueta,
  };
}
