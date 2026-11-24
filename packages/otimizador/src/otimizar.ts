import {
  posicionar,
  type ChapaPlano,
  type Eixo,
  type Material,
  type NoCorte,
  type ParametrosCorte,
  type Peca,
} from '@pro-cutter/core';
import { construir, type Instancia } from './construir.ts';
import { criarAleatorio, embaralhar } from './aleatorio.ts';

export interface OpcoesOtimizacao {
  /** Número de estratégias aleatórias além das determinísticas (padrão 200). */
  iteracoes?: number;
  /** Tempo máximo em ms (padrão 5000). */
  tempoMs?: number;
  /** Semente do gerador aleatório: mesma semente = mesmo resultado (padrão 1). */
  semente?: number;
  /** Peças fixadas pelo usuário numa chapa (número da chapa dentro deste material, a partir de 1). */
  fixadas?: { pecaId: string; chapa: number }[];
  /** Peças que só entram em espaço que sobrou, sem abrir chapa nova (ex.: material alternativo). */
  opcionais?: Peca[];
}

export interface ResultadoOtimizacao {
  chapas: ChapaPlano[];
  /** Quantas estratégias foram avaliadas. */
  avaliadas: number;
  /** Quantas unidades de cada peça opcional entraram no plano. */
  opcionaisColocadas: Record<string, number>;
}

type Ordenacao = (a: Instancia, b: Instancia) => number;

const maiorY = (p: Instancia) => (p.preferirGirada ? p.c : p.l);
const maiorX = (p: Instancia) => (p.preferirGirada ? p.l : p.c);

const ORDENACOES: Ordenacao[] = [
  (a, b) => maiorY(b) - maiorY(a) || maiorX(b) - maiorX(a),
  (a, b) => b.c * b.l - a.c * a.l || maiorY(b) - maiorY(a),
  (a, b) => maiorX(b) - maiorX(a) || maiorY(b) - maiorY(a),
  (a, b) => Math.max(b.c, b.l) - Math.max(a.c, a.l) || b.c * b.l - a.c * a.l,
];

/**
 * Otimiza o corte de peças de UM material: testa estratégias (ordenações × orientação × início em
 * faixas ou colunas) e fica com o plano de menos chapas; no empate, o que coloca mais peças
 * opcionais e depois o de maior sobra útil.
 */
export function otimizar(
  pecas: Peca[],
  material: Material,
  params: ParametrosCorte,
  opcoes: OpcoesOtimizacao = {},
): ResultadoOtimizacao {
  const fixadas = new Map((opcoes.fixadas ?? []).map((f) => [f.pecaId, f.chapa]));
  const instancias = (lista: Peca[], opcional: boolean): Omit<Instancia, 'preferirGirada'>[] =>
    lista.flatMap((p) =>
      Array.from({ length: p.quantidade }, () => ({
        pecaId: p.id,
        c: p.comprimento,
        l: p.largura,
        podeGirar: p.podeGirar && !material.temVeio,
        chapaFixa: opcional ? undefined : fixadas.get(p.id),
        opcional,
      })),
    );
  const base = [...instancias(pecas, false), ...instancias(opcoes.opcionais ?? [], true)];
  const idsOpcionais = new Set((opcoes.opcionais ?? []).map((p) => p.id));
  if (!base.some((b) => !b.opcional)) return { chapas: [], avaliadas: 0, opcionaisColocadas: {} };

  const rnd = criarAleatorio(opcoes.semente ?? 1);
  const limite = Date.now() + (opcoes.tempoMs ?? 5000);
  const iteracoes = opcoes.iteracoes ?? 200;

  let melhor: { chapas: ChapaPlano[]; nota: number[]; opc: Record<string, number> } | undefined;
  let avaliadas = 0;
  let ultimoErro: Error | undefined;

  const avaliar = (inicio: Eixo, ordem: Instancia[]) => {
    // fixadas primeiro (na ordem da chapa), depois livres, e as opcionais por último
    const fixas = ordem.filter((p) => p.chapaFixa !== undefined);
    fixas.sort((a, b) => a.chapaFixa! - b.chapaFixa!);
    const livres = ordem.filter((p) => p.chapaFixa === undefined && !p.opcional);
    const opcionais = ordem.filter((p) => p.opcional);
    try {
      const chapas = construir(material, params, {
        inicio,
        ordem: [...fixas, ...livres, ...opcionais],
      });
      avaliadas++;
      const opc = contarPecas(chapas, idsOpcionais);
      const nota = notaDo(chapas, params, opc);
      if (!melhor || compararNotas(nota, melhor.nota) < 0) melhor = { chapas, nota, opc };
    } catch (e) {
      ultimoErro = e as Error;
    }
  };

  // estratégias determinísticas
  for (const inicio of ['Y', 'X'] as const) {
    for (const girar of [false, true]) {
      for (const ord of ORDENACOES) {
        const inst = base.map((p) => ({ ...p, preferirGirada: girar && p.podeGirar }));
        avaliar(inicio, inst.sort(ord));
      }
    }
  }

  // estratégias aleatórias: perturbação da ordem e da orientação
  for (let i = 0; i < iteracoes && Date.now() < limite; i++) {
    const inicio: Eixo = rnd() < 0.5 ? 'Y' : 'X';
    const ord = ORDENACOES[Math.floor(rnd() * ORDENACOES.length)]!;
    const inst = base.map((p) => ({ ...p, preferirGirada: p.podeGirar && rnd() < 0.5 })).sort(ord);
    avaliar(inicio, perturbar(inst, rnd));
  }

  if (!melhor) throw ultimoErro ?? new Error('Não foi possível montar o plano');
  return { chapas: melhor.chapas, avaliadas, opcionaisColocadas: melhor.opc };
}

function contarPecas(chapas: ChapaPlano[], ids: Set<string>): Record<string, number> {
  const r: Record<string, number> = {};
  const visitar = (nos: NoCorte[]) => {
    for (const n of nos) {
      if (n.filhos.length) visitar(n.filhos);
      else if (n.pecaId && ids.has(n.pecaId)) r[n.pecaId] = (r[n.pecaId] ?? 0) + 1;
    }
  };
  for (const ch of chapas) visitar(ch.nos);
  return r;
}

/** Troca alguns vizinhos de lugar, mantendo a ordem geral. */
function perturbar<T>(lista: T[], rnd: () => number): T[] {
  const r = [...lista];
  const trocas = Math.max(1, Math.floor(r.length * 0.15));
  for (let t = 0; t < trocas; t++) {
    const i = Math.floor(rnd() * r.length);
    const j = Math.min(r.length - 1, i + 1 + Math.floor(rnd() * 3));
    [r[i], r[j]] = [r[j]!, r[i]!];
  }
  return rnd() < 0.1 ? embaralhar(r, rnd) : r;
}

/**
 * Menor é melhor: [nº de chapas, −opcionais colocadas, −maior sobra útil, −área livre na última chapa].
 */
function notaDo(
  chapas: ChapaPlano[],
  params: ParametrosCorte,
  opc: Record<string, number>,
): number[] {
  let maiorSobra = 0;
  let livreUltima = 0;
  chapas.forEach((ch, i) => {
    const g = posicionar(ch, { serra: params.serra, sobraMinima: params.sobraMinima });
    for (const s of g.sobras) {
      if (s.util) maiorSobra = Math.max(maiorSobra, s.c * s.l);
      if (i === chapas.length - 1) livreUltima += s.c * s.l;
    }
  });
  const colocadas = Object.values(opc).reduce((a, b) => a + b, 0);
  return [chapas.length, -colocadas, -maiorSobra, -livreUltima];
}

function compararNotas(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return 0;
}
