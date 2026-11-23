import type { ChapaPlano, Material, ParametrosCorte, Peca, Plano } from '@pro-cutter/core';
import { otimizar, type OpcoesOtimizacao } from './otimizar.ts';

export interface OpcoesProjeto extends Omit<OpcoesOtimizacao, 'fixadas' | 'opcionais'> {
  /** Peça fixada numa chapa: `chapa` é o número dentro do material da peça (1 = primeira chapa dele). */
  fixadas?: { pecaId: string; chapa: number }[];
}

/**
 * Otimiza todas as peças de um projeto, material por material, e devolve um plano com as chapas
 * numeradas em sequência. Peças com `materialAlternativo` primeiro tentam ocupar sobras de outros
 * materiais de mesma espessura (sem aumentar o nº de chapas); o que não couber volta ao próprio material.
 */
export function otimizarProjeto(
  pecas: Peca[],
  materiais: Material[],
  params: ParametrosCorte,
  opcoes: OpcoesProjeto = {},
): Plano {
  const porId = new Map(materiais.map((m) => [m.id, m]));
  for (const p of pecas) {
    if (!porId.has(p.materialId))
      throw new Error(`Peça ${p.nome}: material ${p.materialId} não cadastrado`);
  }

  const alternativas = pecas.filter((p) => p.materialAlternativo);
  const pendentes = new Map(alternativas.map((p) => [p.id, p.quantidade]));
  const comPendentes = (lista: Peca[]) =>
    lista
      .map((p) => ({ ...p, quantidade: pendentes.get(p.id) ?? 0 }))
      .filter((p) => p.quantidade > 0);

  const proprias = (m: Material) =>
    pecas.filter((p) => p.materialId === m.id && !p.materialAlternativo);
  const fixadasDe = (lista: Peca[]) => {
    const ids = new Set(lista.map((p) => p.id));
    return (opcoes.fixadas ?? []).filter((f) => ids.has(f.pecaId));
  };
  const areaPropria = (m: Material) =>
    proprias(m).reduce((s, p) => s + p.comprimento * p.largura * p.quantidade, 0);

  // materiais com mais peças primeiro: mais chances de sobra para as alternativas
  const ordem = [...materiais].sort((a, b) => areaPropria(b) - areaPropria(a));
  const resultado = new Map<string, { chapas: ChapaPlano[]; aceitas: Peca[] }>();

  // 1ª passada: peças próprias + alternativas como opcionais
  for (const m of ordem) {
    const req = proprias(m);
    if (req.length === 0) continue;
    const candidatas = comPendentes(alternativas).filter(
      (p) => porId.get(p.materialId)!.espessura === m.espessura,
    );
    const base = otimizar(req, m, params, { ...opcoes, fixadas: fixadasDe(req) });
    let escolhido = { chapas: base.chapas, aceitas: [] as Peca[] };

    if (candidatas.length > 0) {
      const com = otimizar(req, m, params, {
        ...opcoes,
        fixadas: fixadasDe(req),
        opcionais: candidatas,
      });
      if (
        com.chapas.length <= base.chapas.length &&
        Object.keys(com.opcionaisColocadas).length > 0
      ) {
        const aceitas = candidatas
          .filter((p) => com.opcionaisColocadas[p.id])
          .map((p) => ({ ...p, quantidade: com.opcionaisColocadas[p.id]! }));
        for (const a of aceitas) pendentes.set(a.id, pendentes.get(a.id)! - a.quantidade);
        escolhido = { chapas: com.chapas, aceitas };
      }
    }
    resultado.set(m.id, escolhido);
  }

  // 2ª passada: alternativas que sobraram voltam para o próprio material, como obrigatórias
  for (const m of ordem) {
    const sobrando = comPendentes(alternativas).filter((p) => p.materialId === m.id);
    if (sobrando.length === 0) continue;
    const anteriores = resultado.get(m.id)?.aceitas ?? [];
    const req = [...proprias(m), ...anteriores, ...sobrando];
    const r = otimizar(req, m, params, { ...opcoes, fixadas: fixadasDe(req) });
    for (const s of sobrando) pendentes.set(s.id, 0);
    resultado.set(m.id, { chapas: r.chapas, aceitas: [...anteriores, ...sobrando] });
  }

  // numeração global das chapas, na ordem dos materiais informada
  const chapas: ChapaPlano[] = [];
  for (const m of materiais) {
    for (const ch of resultado.get(m.id)?.chapas ?? [])
      chapas.push({ ...ch, numero: chapas.length + 1 });
  }
  return { chapas };
}
