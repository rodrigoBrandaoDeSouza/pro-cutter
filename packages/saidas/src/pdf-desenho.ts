import { PDFDocument, PageSizes, type PDFPage, type RGB } from 'pdf-lib';
import { metricas, numerarPecas, type Geometria, type Nivel, type Peca } from '@pro-cutter/core';
import type { DadosSaida } from './dados.ts';
import {
  caber,
  carregarFontes,
  COR,
  MM,
  num,
  porcentagem,
  textoSeguro,
  type Fontes,
} from './pdf-util.ts';

const COR_NIVEL: Record<Nivel, RGB> = {
  '1X': COR.nivel1,
  '1Y': COR.nivel1,
  '2X': COR.nivel2,
  '2Y': COR.nivel2,
  '3X': COR.nivel3,
  '3Y': COR.nivel3,
  '4X': COR.nivel3,
  '4Y': COR.nivel3,
};

const MARGEM = 10 * MM;

/** PDF A4 deitado: uma página por chapa com o desenho, a lista de peças e a sequência de cortes. */
export async function pdfDesenho(d: DadosSaida): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Plano de corte - ${d.projeto.nome}`);
  doc.setCreator('pro-cutter');
  const f = await carregarFontes(doc);
  const op = { serra: d.plano.parametros.serra, sobraMinima: d.plano.parametros.sobraMinima };
  const { geometrias, pecas: numeradas } = numerarPecas({ chapas: d.plano.chapas }, op);
  const met = metricas({ chapas: d.plano.chapas }, op);
  const pecas = new Map(d.plano.pecas.map((p) => [p.id, p]));
  const materiais = new Map(d.plano.materiais.map((m) => [m.id, m]));
  const total = d.plano.chapas.length;

  d.plano.chapas.forEach((chapa, k) => {
    const g = geometrias[k]!;
    const numeros = numeradas.filter((n) => n.chapa === chapa.numero).map((n) => n.numero);
    const mat = materiais.get(chapa.materialId);
    const [W, H] = [PageSizes.A4[1], PageSizes.A4[0]];
    const pag = doc.addPage([W, H]);

    // Cabeçalho
    const titulo = `Chapa ${chapa.numero} de ${total}  ·  ${mat?.descricao ?? ''}`;
    pag.drawText(caber(f.negrito, titulo, 14, W * 0.6), {
      x: MARGEM,
      y: H - MARGEM - 12,
      size: 14,
      font: f.negrito,
      color: COR.texto,
    });
    pag.drawText(caber(f.normal, `${d.projeto.nome}  ·  ${d.projeto.cliente}`, 9, W * 0.6), {
      x: MARGEM,
      y: H - MARGEM - 26,
      size: 9,
      font: f.normal,
      color: COR.suave,
    });
    const info = `${num(chapa.comprimento)} × ${num(chapa.largura)} mm  ·  ${g.pecas.length} peças  ·  aproveitamento ${porcentagem(met.chapas[k]!.aproveitamento)}`;
    const info2 = `Plano v${d.plano.versao}  ·  ${d.plano.criadoEm.toLocaleDateString('pt-BR')}  ·  serra ${num(d.plano.parametros.serra)} mm${mat?.temVeio ? '  ·  com veio (→ comprimento)' : ''}`;
    for (const [i, t] of [info, info2].entries()) {
      const s = textoSeguro(f.normal, t);
      pag.drawText(s, {
        x: W - MARGEM - f.normal.widthOfTextAtSize(s, 9),
        y: H - MARGEM - 12 - i * 14,
        size: 9,
        font: f.normal,
        color: COR.suave,
      });
    }

    // Desenho à esquerda (até 66% da largura), deixando ao menos 45 mm embaixo para a sequência
    const UW = W - 2 * MARGEM;
    const y0 = H - MARGEM - 38; // topo do desenho (y do PDF cresce para cima)
    const escala = Math.min(
      (UW * 0.66) / chapa.comprimento,
      (y0 - MARGEM - 45 * MM) / chapa.largura,
    );
    desenharChapa(pag, f, g, pecas, numeros, chapa.comprimento, chapa.largura, escala, MARGEM, y0);
    const larguraDesenho = chapa.comprimento * escala;
    const baseDesenho = y0 - chapa.largura * escala;

    const linhasPecas = g.pecas.map((pp, i) => {
      const p = pecas.get(pp.pecaId);
      const origem = [
        p?.refs?.ambienteId && d.nomes.ambientes[p.refs.ambienteId],
        p?.refs?.moduloId && d.nomes.modulos[p.refs.moduloId],
      ]
        .filter(Boolean)
        .join(' › ');
      const girada = p && pp.c !== p.comprimento ? ' (girada)' : '';
      return `${numeros[i]}. ${p?.nome ?? '?'}  ${num(p?.comprimento ?? pp.c)}×${num(p?.largura ?? pp.l)}${girada}${origem ? `  ${origem}` : ''}`;
    });
    const linhasCortes = g.cortes.map(
      (c, i) =>
        `${i + 1}. ${c.refilo ? 'R' : ''}${c.nivel}  ${c.refilo ? `refilo ${num(c.medida)}` : `${num(c.medida)} mm`}`,
    );
    // Peças ao lado do desenho; sequência embaixo, na largura toda
    const xLista = MARGEM + larguraDesenho + 6 * MM;
    const restoPecas = escreverColunas(pag, f, {
      titulo: 'Peças',
      linhas: linhasPecas,
      x: xLista,
      topo: y0,
      base: baseDesenho,
      largura: W - MARGEM - xLista,
      colunas: W - MARGEM - xLista > 170 * MM ? 2 : 1,
    });
    const restoCortes = escreverColunas(pag, f, {
      titulo: 'Sequência de cortes',
      linhas: linhasCortes,
      x: MARGEM,
      topo: baseDesenho - 6 * MM,
      base: MARGEM,
      largura: UW,
      colunas: 6,
    });

    // O que não coube continua em páginas seguintes
    const pendentes = [
      { titulo: 'Peças (continuação)', linhas: restoPecas },
      { titulo: 'Sequência de cortes (continuação)', linhas: restoCortes },
    ];
    for (const p of pendentes) {
      let linhas = p.linhas;
      while (linhas.length) {
        const cont = doc.addPage([W, H]);
        cont.drawText(textoSeguro(f.negrito, `Chapa ${chapa.numero}`), {
          x: MARGEM,
          y: H - MARGEM - 12,
          size: 12,
          font: f.negrito,
          color: COR.texto,
        });
        linhas = escreverColunas(cont, f, {
          titulo: p.titulo,
          linhas,
          x: MARGEM,
          topo: H - MARGEM - 26,
          base: MARGEM,
          largura: UW,
          colunas: 4,
        });
      }
    }
  });

  return doc.save();
}

function desenharChapa(
  pag: PDFPage,
  f: Fontes,
  g: Geometria,
  pecas: Map<string, Peca>,
  numeros: number[],
  C: number,
  L: number,
  e: number,
  x0: number,
  y0: number,
) {
  // converte coordenadas da chapa (mm, y para baixo) para o PDF (pt, y para cima)
  const X = (x: number) => x0 + x * e;
  const Y = (y: number) => y0 - y * e;
  const ret = (x: number, y: number, c: number, l: number) => ({
    x: X(x),
    y: Y(y + l),
    width: c * e,
    height: l * e,
  });

  pag.drawRectangle({
    ...ret(0, 0, C, L),
    color: COR.chapa,
    borderColor: COR.borda,
    borderWidth: 0.8,
  });
  for (const s of g.sobras)
    pag.drawRectangle({ ...ret(s.x, s.y, s.c, s.l), color: s.util ? COR.sobra : COR.perda });

  g.pecas.forEach((pp, i) => {
    const p = pecas.get(pp.pecaId);
    pag.drawRectangle({
      ...ret(pp.x, pp.y, pp.c, pp.l),
      color: COR.peca,
      borderColor: COR.texto,
      borderWidth: 0.5,
    });
    const fita = p?.fita ?? [0, 0, 0, 0];
    const girada = !!p && pp.c !== p.comprimento;
    const [cima, baixo, esq, dir] = girada
      ? [fita[2], fita[3], fita[0], fita[1]]
      : [fita[0], fita[1], fita[2], fita[3]];
    const t = 1.6;
    const linha = (x1: number, y1: number, x2: number, y2: number) =>
      pag.drawLine({
        start: { x: x1, y: y1 },
        end: { x: x2, y: y2 },
        thickness: t,
        color: COR.fita,
      });
    if (cima > 0) linha(X(pp.x), Y(pp.y) - t / 2, X(pp.x + pp.c), Y(pp.y) - t / 2);
    if (baixo > 0) linha(X(pp.x), Y(pp.y + pp.l) + t / 2, X(pp.x + pp.c), Y(pp.y + pp.l) + t / 2);
    if (esq > 0) linha(X(pp.x) + t / 2, Y(pp.y), X(pp.x) + t / 2, Y(pp.y + pp.l));
    if (dir > 0) linha(X(pp.x + pp.c) - t / 2, Y(pp.y), X(pp.x + pp.c) - t / 2, Y(pp.y + pp.l));

    // número e medida, se couber
    const w = pp.c * e;
    const h = pp.l * e;
    const tam = Math.min(11, Math.max(5, Math.min(w, h) / 3));
    const n = String(numeros[i]);
    const medida = `${num(pp.c)}×${num(pp.l)}`;
    const cx = X(pp.x) + w / 2;
    const cy = Y(pp.y) - h / 2;
    if (w > f.negrito.widthOfTextAtSize(n, tam) + 2 && h > tam + 2) {
      const temMedida = w > f.normal.widthOfTextAtSize(medida, tam * 0.8) + 4 && h > tam * 2.4;
      pag.drawText(n, {
        x: cx - f.negrito.widthOfTextAtSize(n, tam) / 2,
        y: cy + (temMedida ? 1 : -tam / 3),
        size: tam,
        font: f.negrito,
        color: COR.texto,
      });
      if (temMedida) {
        pag.drawText(medida, {
          x: cx - f.normal.widthOfTextAtSize(medida, tam * 0.8) / 2,
          y: cy - tam * 0.95,
          size: tam * 0.8,
          font: f.normal,
          color: COR.suave,
        });
      }
    }
  });

  for (const c of g.cortes) {
    const [a, b] =
      c.eixo === 'X'
        ? [
            { x: X(c.pos), y: Y(c.de) },
            { x: X(c.pos), y: Y(c.ate) },
          ]
        : [
            { x: X(c.de), y: Y(c.pos) },
            { x: X(c.ate), y: Y(c.pos) },
          ];
    pag.drawLine({
      start: a,
      end: b,
      thickness: 0.6,
      color: COR_NIVEL[c.nivel],
      opacity: 0.8,
      ...(c.refilo ? { dashArray: [3, 2] } : {}),
    });
  }
}

interface Colunas {
  titulo: string;
  linhas: string[];
  x: number;
  topo: number;
  base: number;
  largura: number;
  colunas: number;
}

/** Escreve as linhas em colunas dentro da área; devolve as linhas que não couberam. */
function escreverColunas(pag: PDFPage, f: Fontes, b: Colunas): string[] {
  const tam = 7;
  const passo = tam * 1.45;
  pag.drawText(textoSeguro(f.negrito, b.titulo), {
    x: b.x,
    y: b.topo - 8.5,
    size: 8.5,
    font: f.negrito,
    color: COR.texto,
  });
  const porColuna = Math.max(1, Math.floor((b.topo - b.base - passo * 1.8) / passo));
  const larguraColuna = b.largura / b.colunas;
  const cabem = porColuna * b.colunas;
  b.linhas.slice(0, cabem).forEach((t, i) => {
    pag.drawText(caber(f.normal, t, tam, larguraColuna - 6), {
      x: b.x + Math.floor(i / porColuna) * larguraColuna,
      y: b.topo - 8.5 - passo * ((i % porColuna) + 1.4),
      size: tam,
      font: f.normal,
      color: COR.texto,
    });
  });
  return b.linhas.slice(cabem);
}
