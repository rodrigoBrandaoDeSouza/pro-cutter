import {
  nivelInicial,
  proximoNivel,
  type ChapaPlano,
  type Nivel,
  type NoCorte,
} from '@pro-cutter/core';

export interface OpcoesProg {
  /** Texto do atributo `material`, ex.: "MDF-15-Branco-MDF Branco 15mm". */
  materialTexto: string;
  espessura: number;
  /** Quantas chapas iguais cortar com este padrão (padrão 1). */
  quantidade?: number;
}

/** Número no formato do Java Double.toString para os valores usados (550 → "550.0"). */
export function formatarNumero(v: number): string {
  return Number.isInteger(v) ? v.toFixed(1) : String(v);
}

function escaparAtributo(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Gera o .prog de uma chapa no mesmo formato das amostras da CVL:
 * - refilo `R<nível>` antes do primeiro nó de cada grupo que tem refilo;
 * - marcador `<nível>*` (quantity 0, value 0.0) antes do primeiro nó subdividido
 *   que vem depois de peças finais no mesmo grupo;
 * - em cada grupo, peças finais vêm antes de nós subdivididos.
 */
export function gerarProg(chapa: ChapaPlano, op: OpcoesProg): string {
  const cortes: string[] = [];
  const corte = (quantidade: number, tipo: string, valor: number) =>
    cortes.push(
      `<com.cutplanning.cvl.program.cut id="${cortes.length + 1}" quantity="${quantidade}" type="${tipo}" value="${formatarNumero(valor)}" waste="false"/>`,
    );

  const grupo = (nos: NoCorte[], nivel: Nivel, refilo: number | undefined) => {
    if (refilo) corte(1, `R${nivel}`, refilo);
    const filhoNivel = proximoNivel(nivel);
    let houveFolha = false;
    let modoSubdividido = false;

    for (const no of nos) {
      if (no.nivel !== nivel) throw new Error(`Nó ${no.nivel} num grupo de nível ${nivel}`);
      if (no.filhos.length > 0) {
        if (!filhoNivel) throw new Error(`Nível ${nivel} não pode ser subdividido`);
        if (houveFolha && !modoSubdividido) corte(0, `${filhoNivel}*`, 0);
        modoSubdividido = true;
        corte(1, nivel, no.medida);
        grupo(no.filhos, filhoNivel, no.refiloFilhos);
      } else {
        if (modoSubdividido) {
          throw new Error(
            `Peça final ${nivel} ${no.medida} depois de nó subdividido: ordene as peças finais primeiro`,
          );
        }
        houveFolha = true;
        corte(1, nivel, no.medida);
      }
    }
  };

  grupo(chapa.nos, nivelInicial(chapa.inicio), chapa.refilo);

  const raiz =
    `<com.cutplanning.cvl.program lenght="${formatarNumero(chapa.comprimento)}"` +
    ` material="${escaparAtributo(op.materialTexto)}" quantity="${op.quantidade ?? 1}"` +
    ` thickness="${formatarNumero(op.espessura)}" waste="0" width="${formatarNumero(chapa.largura)}">`;

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="no"?>' +
    raiz +
    cortes.join('') +
    '</com.cutplanning.cvl.program>'
  );
}
