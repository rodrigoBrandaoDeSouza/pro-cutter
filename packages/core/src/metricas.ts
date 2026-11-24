import { posicionar, type OpcoesGeometria } from './geometria.ts';
import type { Plano } from './tipos.ts';

/** Áreas em mm²; aproveitamento de 0 a 1. */
export interface Resumo {
  chapas: number;
  pecas: number;
  areaChapa: number;
  areaPecas: number;
  aproveitamento: number;
  sobraUtil: number;
  maiorSobraUtil: number;
  /** Tudo que não é peça nem sobra útil: serra, refilos e sobras pequenas. */
  perda: number;
}

export interface MetricaChapa extends Omit<Resumo, 'chapas'> {
  numero: number;
  materialId: string;
}

export interface MetricasPlano {
  chapas: MetricaChapa[];
  porMaterial: (Resumo & { materialId: string })[];
  total: Resumo;
}

export function metricas(plano: Plano, op: OpcoesGeometria): MetricasPlano {
  const chapas: MetricaChapa[] = plano.chapas.map((ch) => {
    const g = posicionar(ch, op);
    const areaChapa = ch.comprimento * ch.largura;
    const areaPecas = g.pecas.reduce((s, p) => s + p.c * p.l, 0);
    const uteis = g.sobras.filter((s) => s.util).map((s) => s.c * s.l);
    const sobraUtil = uteis.reduce((a, b) => a + b, 0);
    return {
      numero: ch.numero,
      materialId: ch.materialId,
      pecas: g.pecas.length,
      areaChapa,
      areaPecas,
      aproveitamento: areaPecas / areaChapa,
      sobraUtil,
      maiorSobraUtil: Math.max(0, ...uteis),
      perda: areaChapa - areaPecas - sobraUtil,
    };
  });

  const resumir = (lista: MetricaChapa[]): Resumo => {
    const soma = (f: (m: MetricaChapa) => number) => lista.reduce((s, m) => s + f(m), 0);
    const areaChapa = soma((m) => m.areaChapa);
    const areaPecas = soma((m) => m.areaPecas);
    return {
      chapas: lista.length,
      pecas: soma((m) => m.pecas),
      areaChapa,
      areaPecas,
      aproveitamento: areaChapa ? areaPecas / areaChapa : 0,
      sobraUtil: soma((m) => m.sobraUtil),
      maiorSobraUtil: Math.max(0, ...lista.map((m) => m.maiorSobraUtil)),
      perda: soma((m) => m.perda),
    };
  };

  const materiais = [...new Set(chapas.map((c) => c.materialId))];
  return {
    chapas,
    porMaterial: materiais.map((id) => ({
      materialId: id,
      ...resumir(chapas.filter((c) => c.materialId === id)),
    })),
    total: resumir(chapas),
  };
}
