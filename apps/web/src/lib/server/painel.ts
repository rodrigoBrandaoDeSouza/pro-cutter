import 'server-only';
import {
  consumoDeFita,
  metricas,
  type ChapaPlano,
  type Material,
  type ParametrosCorte,
  type Peca,
} from '@pro-cutter/core';
import type { PrismaDaEmpresa } from '@pro-cutter/db';
import type { Status } from '@/lib/status';

/** Projetos nestes status já tiveram as chapas cortadas (ou estão sendo cortadas). */
const CORTADOS: Status[] = ['EM_CORTE', 'CORTADO', 'ENTREGUE'];

const M2 = 1e6;

export interface Totais {
  projetos: number;
  chapas: number;
  pecas: number;
  /** m² */
  areaChapa: number;
  areaPecas: number;
  sobraUtil: number;
  desperdicio: number;
  /** Peças ÷ (chapas − sobras úteis), 0 a 1: as sobras úteis voltam ao estoque. */
  aproveitamento: number;
  /** Peças ÷ chapas inteiras, 0 a 1. */
  aproveitamentoBruto: number;
  /** R$; só soma materiais com preço */
  custo: number;
  custoDesperdicio: number;
  /** Chapas a menos do que se gastaria com o aproveitamento de referência (pode ser negativo). */
  economiaChapas: number;
  economiaReais: number;
  fitaMetros: number;
}

export interface Mes extends Totais {
  /** AAAA-MM */
  mes: string;
}

export interface LinhaMaterial extends Totais {
  materialId: string;
  descricao: string;
  temPreco: boolean;
}

export interface LinhaProjeto {
  id: string;
  nome: string;
  cliente: string;
  chapas: number;
  aproveitamento: number;
  desperdicio: number;
}

export interface Painel {
  meses: number;
  referencia: number;
  periodo: Totais;
  anterior: Totais;
  mensal: Mes[];
  materiais: LinhaMaterial[];
  piores: LinhaProjeto[];
  melhores: LinhaProjeto[];
  funil: { status: Status; projetos: number; chapas: number }[];
  materiaisSemPreco: number;
}

const vazio = (): Totais => ({
  projetos: 0,
  chapas: 0,
  pecas: 0,
  areaChapa: 0,
  areaPecas: 0,
  sobraUtil: 0,
  desperdicio: 0,
  aproveitamento: 0,
  aproveitamentoBruto: 0,
  custo: 0,
  custoDesperdicio: 0,
  economiaChapas: 0,
  economiaReais: 0,
  fitaMetros: 0,
});

type Parcela = Omit<Totais, 'aproveitamento' | 'aproveitamentoBruto' | 'projetos'>;

const liquido = (pecas: number, chapa: number, sobra: number) =>
  chapa - sobra > 0 ? pecas / (chapa - sobra) : 0;

function somar(a: Totais, b: Parcela) {
  a.chapas += b.chapas;
  a.pecas += b.pecas;
  a.areaChapa += b.areaChapa;
  a.areaPecas += b.areaPecas;
  a.sobraUtil += b.sobraUtil;
  a.desperdicio += b.desperdicio;
  a.custo += b.custo;
  a.custoDesperdicio += b.custoDesperdicio;
  a.economiaChapas += b.economiaChapas;
  a.economiaReais += b.economiaReais;
  a.fitaMetros += b.fitaMetros;
  a.aproveitamento = liquido(a.areaPecas, a.areaChapa, a.sobraUtil);
  a.aproveitamentoBruto = a.areaChapa ? a.areaPecas / a.areaChapa : 0;
}

const chaveMes = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export async function montarPainel(db: PrismaDaEmpresa, meses: number): Promise<Painel> {
  const agora = new Date();
  const inicio = new Date(agora.getFullYear(), agora.getMonth() - (meses - 1), 1);
  const inicioAnterior = new Date(agora.getFullYear(), agora.getMonth() - (2 * meses - 1), 1);

  const [cfg, materiaisBanco, planos, porStatus] = await Promise.all([
    db.configuracao.findFirst({ select: { aproveitamentoReferencia: true } }),
    db.material.findMany({ select: { id: true, descricao: true, precoChapa: true } }),
    db.planoDeCorte.findMany({
      where: {
        status: 'ATUAL',
        criadoEm: { gte: inicioAnterior },
        projeto: { status: { in: CORTADOS } },
      },
      select: {
        criadoEm: true,
        chapas: true,
        pecas: true,
        materiais: true,
        parametros: true,
        projeto: { select: { id: true, nome: true, cliente: { select: { nome: true } } } },
      },
    }),
    db.projeto.groupBy({ by: ['status'], _count: true }),
  ]);
  const referencia = cfg?.aproveitamentoReferencia ?? 0.7;
  const precoDe = new Map(materiaisBanco.map((m) => [m.id, m.precoChapa]));
  const nomeDe = new Map(materiaisBanco.map((m) => [m.id, m.descricao]));

  const periodo = vazio();
  const anterior = vazio();
  const mensal = new Map<string, Mes>();
  for (let i = 0; i < meses; i++) {
    const mes = chaveMes(new Date(inicio.getFullYear(), inicio.getMonth() + i, 1));
    mensal.set(mes, { ...vazio(), mes });
  }
  const porMaterial = new Map<string, LinhaMaterial>();
  const projetos: LinhaProjeto[] = [];

  for (const p of planos) {
    const params = p.parametros as unknown as ParametrosCorte;
    const chapas = p.chapas as unknown as ChapaPlano[];
    const materiais = p.materiais as unknown as Material[];
    const pecas = p.pecas as unknown as Peca[];
    const m = metricas({ chapas }, { serra: params.serra, sobraMinima: params.sobraMinima });
    const doPeriodo = p.criadoEm >= inicio;
    const alvo = doPeriodo ? periodo : anterior;
    const mes = doPeriodo ? mensal.get(chaveMes(p.criadoEm)) : undefined;

    const fitaPorMaterial = new Map<string, number>();
    for (const f of consumoDeFita(pecas))
      fitaPorMaterial.set(f.materialId, (fitaPorMaterial.get(f.materialId) ?? 0) + f.metros);

    for (const r of m.porMaterial) {
      const mat = materiais.find((x) => x.id === r.materialId);
      const preco = precoDe.get(r.materialId) ?? null;
      const areaUmaChapa = mat ? mat.chapa.comprimento * mat.chapa.largura : r.areaChapa / r.chapas;
      // Chapas de fato consumidas: as sobras úteis voltam ao estoque
      const consumidas = (r.areaChapa - r.sobraUtil) / areaUmaChapa;
      const economiaChapas = r.areaPecas / (areaUmaChapa * referencia) - consumidas;
      const parcela = {
        chapas: r.chapas,
        pecas: r.pecas,
        areaChapa: r.areaChapa / M2,
        areaPecas: r.areaPecas / M2,
        sobraUtil: r.sobraUtil / M2,
        desperdicio: r.perda / M2,
        custo: (preco ?? 0) * r.chapas,
        custoDesperdicio: (preco ?? 0) * (r.perda / areaUmaChapa),
        economiaChapas,
        economiaReais: (preco ?? 0) * economiaChapas,
        fitaMetros: fitaPorMaterial.get(r.materialId) ?? 0,
      };
      somar(alvo, parcela);
      if (mes) somar(mes, parcela);
      if (doPeriodo) {
        let linha = porMaterial.get(r.materialId);
        if (!linha) {
          linha = {
            ...vazio(),
            materialId: r.materialId,
            descricao: nomeDe.get(r.materialId) ?? mat?.descricao ?? 'Material removido',
            temPreco: preco != null,
          };
          porMaterial.set(r.materialId, linha);
        }
        somar(linha, parcela);
        linha.projetos++;
      }
    }
    alvo.projetos++;
    if (mes) mes.projetos++;
    if (doPeriodo) {
      projetos.push({
        id: p.projeto.id,
        nome: p.projeto.nome,
        cliente: p.projeto.cliente.nome,
        chapas: m.total.chapas,
        aproveitamento: liquido(m.total.areaPecas, m.total.areaChapa, m.total.sobraUtil),
        desperdicio: m.total.perda / M2,
      });
    }
  }

  // Funil: projetos abertos e as chapas previstas nos planos atuais
  const abertos = await db.planoDeCorte.findMany({
    where: { status: 'ATUAL', projeto: { status: { in: ['ORCAMENTO', 'APROVADO', 'EM_CORTE'] } } },
    select: { chapas: true, projeto: { select: { status: true } } },
  });
  const chapasPorStatus = new Map<string, number>();
  for (const a of abertos) {
    const n = (a.chapas as unknown as ChapaPlano[]).length;
    chapasPorStatus.set(a.projeto.status, (chapasPorStatus.get(a.projeto.status) ?? 0) + n);
  }
  const funil = (['ORCAMENTO', 'APROVADO', 'EM_CORTE'] as Status[]).map((status) => ({
    status,
    projetos: porStatus.find((s) => s.status === status)?._count ?? 0,
    chapas: chapasPorStatus.get(status) ?? 0,
  }));

  const ordenados = [...projetos].sort((a, b) => a.aproveitamento - b.aproveitamento);
  return {
    meses,
    referencia,
    periodo,
    anterior,
    mensal: [...mensal.values()],
    materiais: [...porMaterial.values()].sort((a, b) => b.chapas - a.chapas),
    piores: ordenados.slice(0, 5),
    melhores: ordenados.slice(-5).reverse(),
    funil,
    materiaisSemPreco: materiaisBanco.filter((m) => m.precoChapa == null).length,
  };
}
