import 'server-only';
import type { Fitas, Material, Peca } from '@pro-cutter/core';
import type { PrismaDaEmpresa } from '@pro-cutter/db';
import {
  gerarPecas,
  resolverRegras,
  type ErroRegra,
  type Modulo,
  type TipoModulo,
  type ValoresRegras,
} from '@pro-cutter/regras';

type PecaBanco = {
  id: string;
  nome: string;
  tipo: string;
  comprimento: number;
  largura: number;
  espessura: number;
  quantidade: number;
  materialId: string;
  fita: number[];
  podeGirar: boolean;
  materialAlternativo: boolean;
  origem: 'XML' | 'GERADA' | 'MANUAL';
  ambienteId: string;
  moduloId: string | null;
  promobId: string | null;
};

const ORIGEM = { XML: 'xml', GERADA: 'gerada', MANUAL: 'manual' } as const;

/** Peça do banco → peça do domínio (core). */
export function pecaDoBanco(p: PecaBanco): Peca {
  return {
    id: p.id,
    nome: p.nome,
    tipo: p.tipo,
    comprimento: p.comprimento,
    largura: p.largura,
    espessura: p.espessura,
    quantidade: p.quantidade,
    materialId: p.materialId,
    fita: [p.fita[0] ?? 0, p.fita[1] ?? 0, p.fita[2] ?? 0, p.fita[3] ?? 0] as Fitas,
    podeGirar: p.podeGirar,
    materialAlternativo: p.materialAlternativo,
    origem: ORIGEM[p.origem],
    refs: {
      ambienteId: p.ambienteId,
      ...(p.moduloId ? { moduloId: p.moduloId } : {}),
      ...(p.promobId ? { promobId: p.promobId } : {}),
    },
  };
}

export function materialDoBanco(m: {
  id: string;
  descricao: string;
  espessura: number;
  chapaComprimento: number;
  chapaLargura: number;
  temVeio: boolean;
}): Material {
  return {
    id: m.id,
    descricao: m.descricao,
    espessura: m.espessura,
    chapa: { comprimento: m.chapaComprimento, largura: m.chapaLargura },
    temVeio: m.temVeio,
  };
}

/** Qualquer mudança em peças invalida o plano de corte atual do projeto. */
export async function desatualizarPlano(db: PrismaDaEmpresa, projetoId: string) {
  await db.planoDeCorte.updateMany({
    where: { projetoId, status: 'ATUAL' },
    data: { status: 'DESATUALIZADO' },
  });
  await db.projeto.update({ where: { id: projetoId }, data: { atualizadoEm: new Date() } });
}

interface ModuloBanco {
  id: string;
  nome: string;
  tipoId: string;
  L: number;
  A: number;
  P: number;
  nPortas: number;
  materialCaixaId: string;
  materialPortaId: string | null;
  materialFundoId: string | null;
  regras: unknown;
  extras: unknown;
  ambienteId: string;
}

export function moduloDoBanco(m: ModuloBanco): Modulo {
  return {
    id: m.id,
    nome: m.nome,
    tipoId: m.tipoId,
    L: m.L,
    A: m.A,
    P: m.P,
    nPortas: m.nPortas,
    materiais: {
      caixa: m.materialCaixaId,
      ...(m.materialPortaId ? { porta: m.materialPortaId } : {}),
      ...(m.materialFundoId ? { fundo: m.materialFundoId } : {}),
    },
    regras: (m.regras ?? {}) as Partial<ValoresRegras>,
    extras: (m.extras ?? {}) as Record<string, number>,
    ambienteId: m.ambienteId,
  };
}

/** Calcula as peças de um módulo com as regras do projeto + as sobrescritas do módulo. */
export function calcularPecasDoModulo(
  modulo: Modulo,
  tipos: TipoModulo[],
  regrasProjeto: ValoresRegras,
  materiais: Material[],
): { pecas: Peca[]; erros: ErroRegra[] } {
  const tipo = tipos.find((t) => t.id === modulo.tipoId);
  if (!tipo) {
    return {
      pecas: [],
      erros: [
        {
          peca: modulo.nome,
          campo: 'material',
          mensagem: `Tipo de módulo "${modulo.tipoId}" não existe neste projeto`,
        },
      ],
    };
  }
  let regras: ValoresRegras;
  try {
    regras = resolverRegras(regrasProjeto, {}, modulo.regras ?? {});
  } catch (e) {
    return {
      pecas: [],
      erros: [{ peca: modulo.nome, campo: 'material', mensagem: (e as Error).message }],
    };
  }
  return gerarPecas(modulo, tipo, regras, materiais);
}

/** Substitui no banco as peças geradas de um módulo. */
export async function gravarPecasGeradas(
  db: PrismaDaEmpresa,
  empresaId: string,
  modulo: Modulo & { ambienteId: string },
  pecas: Peca[],
) {
  await db.peca.deleteMany({ where: { moduloId: modulo.id, origem: 'GERADA' } });
  if (pecas.length === 0) return;
  await db.peca.createMany({
    data: pecas.map((p, i) => ({
      empresaId,
      ambienteId: modulo.ambienteId,
      moduloId: modulo.id,
      origem: 'GERADA' as const,
      nome: p.nome,
      tipo: p.tipo ?? 'outro',
      comprimento: p.comprimento,
      largura: p.largura,
      espessura: p.espessura,
      quantidade: p.quantidade,
      materialId: p.materialId,
      fita: [...p.fita],
      podeGirar: p.podeGirar,
      ordem: i,
    })),
  });
}
