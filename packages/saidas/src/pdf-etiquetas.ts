import { PDFDocument, type PDFPage } from 'pdf-lib';
import QRCode from 'qrcode';
import { numerarPecas } from '@pro-cutter/core';
import type { DadosSaida } from './dados.ts';
import { caber, carregarFontes, COR, MM, num } from './pdf-util.ts';

/** Conteúdo do QR: curto e sem dados pessoais. Identifica projeto, versão do plano e número da peça. */
export function conteudoQr(projetoId: string, versao: number, numero: number): string {
  return `PC:${projetoId}:${versao}:${numero}`;
}

/**
 * PDF de etiquetas para impressora térmica: uma página por peça física, no tamanho configurado.
 * Layout pensado para 100×50 mm e escalado proporcionalmente para outros tamanhos.
 */
export async function pdfEtiquetas(d: DadosSaida): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Etiquetas - ${d.projeto.nome}`);
  doc.setCreator('pro-cutter');
  const f = await carregarFontes(doc);
  const W = d.etiqueta.largura * MM;
  const H = d.etiqueta.altura * MM;
  const k = Math.min(d.etiqueta.largura / 100, d.etiqueta.altura / 50); // fator de escala do layout
  const m = 2.5 * MM * k; // margem interna
  const op = { serra: d.plano.parametros.serra, sobraMinima: d.plano.parametros.sobraMinima };
  const { pecas: numeradas } = numerarPecas({ chapas: d.plano.chapas }, op);
  const pecas = new Map(d.plano.pecas.map((p) => [p.id, p]));
  const materiais = new Map(d.plano.materiais.map((x) => [x.id, x]));
  const totalChapas = d.plano.chapas.length;

  for (const n of numeradas) {
    const p = pecas.get(n.pecaId);
    if (!p) continue;
    const pag = doc.addPage([W, H]);
    const util = W - 2 * m;
    const qr = Math.min(H * 0.42, 20 * MM * k);

    // linha 1: cliente · projeto  |  nº e chapa
    const id = `nº ${n.numero}  ·  chapa ${n.chapa}/${totalChapas}`;
    const tId = 7.5 * k;
    pag.drawText(id, {
      x: W - m - f.negrito.widthOfTextAtSize(id, tId),
      y: H - m - tId,
      size: tId,
      font: f.negrito,
      color: COR.texto,
    });
    pag.drawText(
      caber(
        f.normal,
        `${d.projeto.cliente} · ${d.projeto.nome}`,
        6.5 * k,
        util - f.negrito.widthOfTextAtSize(id, tId) - 4,
      ),
      {
        x: m,
        y: H - m - 6.5 * k,
        size: 6.5 * k,
        font: f.normal,
        color: COR.suave,
      },
    );

    // nome e medida em destaque
    const yNome = H - m - 18 * k;
    pag.drawText(caber(f.negrito, p.nome, 11 * k, util), {
      x: m,
      y: yNome,
      size: 11 * k,
      font: f.negrito,
      color: COR.texto,
    });
    const medida = `${num(p.comprimento)} × ${num(p.largura)}`;
    const tMed = 17 * k;
    pag.drawText(medida, {
      x: m,
      y: yNome - tMed - 1.5 * k,
      size: tMed,
      font: f.negrito,
      color: COR.texto,
    });
    pag.drawText(` mm · ${num(p.espessura)} esp.`, {
      x: m + f.negrito.widthOfTextAtSize(medida, tMed),
      y: yNome - tMed - 1.5 * k,
      size: 7 * k,
      font: f.normal,
      color: COR.suave,
    });

    // origem e material
    const origem = [
      p.refs?.ambienteId && d.nomes.ambientes[p.refs.ambienteId],
      p.refs?.moduloId && d.nomes.modulos[p.refs.moduloId],
    ]
      .filter(Boolean)
      .join(' › ');
    const larguraTexto = util - qr - 3 * MM * k;
    const yOrigem = yNome - tMed - 10 * k;
    if (origem)
      pag.drawText(caber(f.normal, origem, 7 * k, larguraTexto), {
        x: m,
        y: yOrigem,
        size: 7 * k,
        font: f.normal,
        color: COR.texto,
      });
    pag.drawText(
      caber(f.normal, materiais.get(p.materialId)?.descricao ?? '', 7 * k, larguraTexto),
      {
        x: m,
        y: yOrigem - 9 * k,
        size: 7 * k,
        font: f.normal,
        color: COR.suave,
      },
    );

    // fita (desenho) e QR
    desenharFita(pag, p.fita, m, m, 16 * MM * k, 8 * MM * k);
    const espFita = Math.max(...p.fita);
    pag.drawText(espFita > 0 ? `fita ${num(espFita, 2)} mm` : 'sem fita', {
      x: m + 18 * MM * k,
      y: m + 2.5 * MM * k,
      size: 6.5 * k,
      font: f.normal,
      color: COR.suave,
    });
    desenharQr(pag, conteudoQr(d.projeto.id, d.plano.versao, n.numero), W - m - qr, m, qr);
  }
  return doc.save();
}

/** Retângulo da peça com as bordas de fita grossas: [comp. superior, comp. inferior, larg. esquerda, larg. direita]. */
function desenharFita(
  pag: PDFPage,
  fita: readonly number[],
  x: number,
  y: number,
  w: number,
  h: number,
) {
  pag.drawRectangle({ x, y, width: w, height: h, borderColor: COR.borda, borderWidth: 0.6 });
  const t = 2;
  const l = (x1: number, y1: number, x2: number, y2: number) =>
    pag.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness: t,
      color: COR.texto,
    });
  if ((fita[0] ?? 0) > 0) l(x, y + h - t / 2, x + w, y + h - t / 2);
  if ((fita[1] ?? 0) > 0) l(x, y + t / 2, x + w, y + t / 2);
  if ((fita[2] ?? 0) > 0) l(x + t / 2, y, x + t / 2, y + h);
  if ((fita[3] ?? 0) > 0) l(x + w - t / 2, y, x + w - t / 2, y + h);
}

/** QR desenhado como quadrados vetoriais (nítido em qualquer impressora). */
function desenharQr(pag: PDFPage, texto: string, x: number, y: number, lado: number) {
  const qr = QRCode.create(texto, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const modulo = lado / n;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) {
        pag.drawRectangle({
          x: x + c * modulo,
          y: y + lado - (r + 1) * modulo,
          width: modulo + 0.05,
          height: modulo + 0.05,
          color: COR.texto,
        });
      }
    }
  }
}
