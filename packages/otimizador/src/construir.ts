import {
  indiceNivel,
  nivelMaximo,
  type ChapaPlano,
  type Eixo,
  type Material,
  type Nivel,
  type NoCorte,
  type ParametrosCorte,
} from '@pro-cutter/core';

/** Uma unidade física de peça a cortar. */
export interface Instancia {
  pecaId: string;
  /** Medida no eixo X na orientação original. */
  c: number;
  /** Medida no eixo Y na orientação original. */
  l: number;
  podeGirar: boolean;
  /** Prefere a orientação girada (só se puder girar). */
  preferirGirada: boolean;
  /** Número da chapa em que a peça deve ficar (fixada pelo usuário). */
  chapaFixa?: number;
  /** Só entra em espaço que sobrou; nunca abre chapa nova (ex.: material alternativo). */
  opcional?: boolean;
}

interface Orientacao {
  x: number;
  y: number;
}

export interface Estrategia {
  inicio: Eixo;
  /** Ordem de preferência das instâncias. */
  ordem: Instancia[];
}

interface Bordas {
  /** A borda inicial no eixo X é de fábrica (ainda não serrada). */
  x: boolean;
  y: boolean;
}

/**
 * Monta as chapas com uma heurística construtiva em 4 degraus: faixa → coluna → linha → peça
 * (escada 1Y→2X→2Y→3X), opcionalmente dentro de colunas 1X (início em X).
 * Em cada grupo as peças finais vêm antes dos nós subdivididos (exigência da CVL).
 */
export function construir(
  material: Material,
  params: ParametrosCorte,
  estrategia: Estrategia,
): ChapaPlano[] {
  const { serra, refiloFabrica, refiloSerrado } = params;
  const maxIdx = indiceNivel(nivelMaximo(params.niveisMax));
  const permitido = (n: Nivel) => indiceNivel(n) <= maxIdx;
  const refilo = (fabrica: boolean) => (fabrica ? refiloFabrica : refiloSerrado);
  const C = material.chapa.comprimento;
  const L = material.chapa.largura;

  const restantes = [...estrategia.ordem];
  let chapaAtual = 0;

  const orientacoes = (p: Instancia): Orientacao[] => {
    const normal = { x: p.c, y: p.l };
    if (!p.podeGirar || p.c === p.l) return [normal];
    const girada = { x: p.l, y: p.c };
    return p.preferirGirada ? [girada, normal] : [normal, girada];
  };

  const disponivel = (p: Instancia) => p.chapaFixa === undefined || p.chapaFixa === chapaAtual;

  /** Primeira instância (na ordem de preferência) com orientação que satisfaz `cond`; remove-a. */
  const tirar = (cond: (o: Orientacao) => boolean): { p: Instancia; o: Orientacao } | undefined => {
    for (let i = 0; i < restantes.length; i++) {
      const p = restantes[i]!;
      if (!disponivel(p)) continue;
      for (const o of orientacoes(p)) {
        if (cond(o)) {
          restantes.splice(i, 1);
          return { p, o };
        }
      }
    }
    return undefined;
  };

  const folha = (nivel: Nivel, medida: number, pecaId: string): NoCorte => ({
    nivel,
    medida,
    filhos: [],
    pecaId,
  });

  /** Peças finais primeiro, depois subdivididos (ordem estável). */
  const ordenarGrupo = (nos: NoCorte[]) => [
    ...nos.filter((n) => n.filhos.length === 0),
    ...nos.filter((n) => n.filhos.length > 0),
  ];

  /** Linhas (2Y) dentro de uma coluna de largura w e altura h. A primeira linha já é a semente. */
  const linhas = (w: number, h: number, semente: { p: Instancia; o: Orientacao }): NoCorte => {
    const ref = refilo(false);
    const capY = h - ref - serra;
    const capX = w - ref - serra; // linha subdividida em 3X
    const nos: NoCorte[] = [folha('2Y', semente.o.y, semente.p.pecaId)];
    let usado = semente.o.y;

    for (;;) {
      const max = capY - usado - serra;
      const sub3X = permitido('3X');
      const achada = tirar((o) => o.y <= max && (o.x === w || (sub3X && o.x <= capX)));
      if (!achada) break;
      const { p, o } = achada;
      usado += serra + o.y;
      if (o.x === w) {
        nos.push(folha('2Y', o.y, p.pecaId));
        continue;
      }
      // linha subdividida: peças da mesma altura lado a lado
      const filhos = [folha('3X', o.x, p.pecaId)];
      let usadoX = o.x;
      for (;;) {
        const maxX = capX - usadoX - serra;
        const lado = tirar((q) => q.y === o.y && q.x <= maxX);
        if (!lado) break;
        filhos.push(folha('3X', lado.o.x, lado.p.pecaId));
        usadoX += serra + lado.o.x;
      }
      nos.push({ nivel: '2Y', medida: o.y, refiloFilhos: refilo(false), filhos });
    }
    return { nivel: '2X', medida: w, refiloFilhos: ref, filhos: ordenarGrupo(nos) };
  };

  /** Colunas (2X) dentro de uma faixa de altura h; `capX` = espaço útil já descontado o refilo. */
  const colunas = (
    capX: number,
    h: number,
    semente: { p: Instancia; o: Orientacao },
  ): NoCorte[] => {
    const capYLinhas = h - refilo(false) - serra;
    const sub2Y = permitido('2Y');
    const nos: NoCorte[] = [];
    let usado = 0;

    const colocar = (s: { p: Instancia; o: Orientacao }) => {
      usado += (nos.length ? serra : 0) + s.o.x;
      nos.push(s.o.y === h ? folha('2X', s.o.x, s.p.pecaId) : linhas(s.o.x, h, s));
    };
    colocar(semente);

    for (;;) {
      const max = capX - usado - serra;
      // 1º: peça com a altura exata da faixa (coluna sem sobra); 2º: coluna subdividida
      const achada =
        tirar((o) => o.x <= max && o.y === h) ??
        (sub2Y ? tirar((o) => o.x <= max && o.y <= capYLinhas) : undefined);
      if (!achada) break;
      colocar(achada);
    }
    return ordenarGrupo(nos);
  };

  /** Faixas (1Y) numa região w × h com as bordas iniciais indicadas. */
  const faixas = (w: number, h: number, bordas: Bordas): NoCorte[] => {
    const refY = refilo(bordas.y);
    const refX = refilo(bordas.x);
    const capY = h - refY - serra;
    const capX = w - refX - serra;
    const nos: NoCorte[] = [];
    let usado = 0;

    for (;;) {
      const max = capY - usado - (nos.length ? serra : 0);
      // semente da faixa: peça inteira na largura (faixa final) ou que caiba como coluna
      const semente = tirar((o) => o.y <= max && (o.x === w || o.x <= capX));
      if (!semente) break;
      const { p, o } = semente;
      usado += (nos.length ? serra : 0) + o.y;
      if (o.x === w) {
        nos.push(folha('1Y', o.y, p.pecaId));
        continue;
      }
      nos.push({
        nivel: '1Y',
        medida: o.y,
        refiloFilhos: refX,
        filhos: colunas(capX, o.y, semente),
      });
    }
    return ordenarGrupo(nos);
  };

  /** Colunas 1X na chapa inteira, cada uma preenchida com faixas. */
  const colunas1X = (): NoCorte[] => {
    const capX = C - refiloFabrica - serra;
    const capY = L - refiloFabrica - serra;
    const nos: NoCorte[] = [];
    let usado = 0;
    for (;;) {
      const max = capX - usado - (nos.length ? serra : 0);
      const semente = tirar((o) => o.x <= max && (o.y === L || o.y <= capY));
      if (!semente) break;
      const w = semente.o.x;
      usado += (nos.length ? serra : 0) + w;
      if (semente.o.y === L) {
        nos.push(folha('1X', w, semente.p.pecaId));
        continue;
      }
      restantes.unshift(semente.p); // a semente define a largura e abre a primeira faixa
      nos.push({
        nivel: '1X',
        medida: w,
        refiloFilhos: refiloFabrica,
        filhos: faixas(w, L, { x: false, y: true }),
      });
    }
    return ordenarGrupo(nos);
  };

  const obrigatorias = () => restantes.filter((r) => !r.opcional).length;
  const chapas: ChapaPlano[] = [];

  while (obrigatorias() > 0) {
    chapaAtual = chapas.length + 1;

    const perdida = restantes.find((r) => r.chapaFixa !== undefined && r.chapaFixa < chapaAtual);
    if (perdida) {
      throw new Error(
        `Peça ${perdida.pecaId} fixada na chapa ${perdida.chapaFixa}, mas não coube nela`,
      );
    }

    const antes = obrigatorias();
    const nos = estrategia.inicio === 'X' ? colunas1X() : faixas(C, L, { x: true, y: true });

    if (obrigatorias() === antes) {
      const livres = restantes.filter((r) => !r.opcional && r.chapaFixa === undefined);
      const futuras = restantes.filter(
        (r) => r.chapaFixa !== undefined && r.chapaFixa > chapaAtual,
      );
      if (livres.length === 0 && futuras.length > 0) {
        // só sobraram peças fixadas em chapas que não vão existir: trazê-las para a próxima chapa
        for (const r of futuras) r.chapaFixa = r.chapaFixa! - 1;
        continue;
      }
      const p = restantes.find((r) => !r.opcional && disponivel(r)) ?? restantes[0]!;
      throw new Error(`Peça ${p.pecaId} (${p.c}×${p.l}) não cabe na chapa ${C}×${L}`);
    }
    chapas.push({
      numero: chapaAtual,
      materialId: material.id,
      comprimento: C,
      largura: L,
      inicio: estrategia.inicio,
      refilo: refiloFabrica,
      nos,
    });
  }
  return chapas;
}
