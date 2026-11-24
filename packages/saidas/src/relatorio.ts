import { PDFDocument, PageSizes, type PDFPage } from 'pdf-lib';
import { metricas, type Resumo } from '@pro-cutter/core';
import type { DadosSaida } from './dados.ts';
import { consumoDeFita } from './fita.ts';
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

/** Folga sugerida na compra de fita (perda na coladeira e nas pontas). */
export const FOLGA_FITA = 0.1;

export interface RelatorioMaterial {
  materiais: (Resumo & { materialId: string; descricao: string; espessura: number })[];
  total: Resumo;
  fita: {
    materialId: string;
    descricao: string;
    espessura: number;
    metros: number;
    comFolga: number;
  }[];
  chapas: { numero: number; descricao: string; pecas: number; aproveitamento: number }[];
}

export function relatorioMaterial(d: DadosSaida): RelatorioMaterial {
  const op = { serra: d.plano.parametros.serra, sobraMinima: d.plano.parametros.sobraMinima };
  const met = metricas({ chapas: d.plano.chapas }, op);
  const mat = new Map(d.plano.materiais.map((m) => [m.id, m]));
  return {
    materiais: met.porMaterial.map((r) => ({
      ...r,
      descricao: mat.get(r.materialId)?.descricao ?? r.materialId,
      espessura: mat.get(r.materialId)?.espessura ?? 0,
    })),
    total: met.total,
    fita: consumoDeFita(d.plano.pecas).map((c) => ({
      ...c,
      descricao: mat.get(c.materialId)?.descricao ?? c.materialId,
      comFolga: Math.ceil(c.metros * (1 + FOLGA_FITA)),
    })),
    chapas: met.chapas.map((c) => ({
      numero: c.numero,
      descricao: mat.get(c.materialId)?.descricao ?? c.materialId,
      pecas: c.pecas,
      aproveitamento: c.aproveitamento,
    })),
  };
}

const m2 = (mm2: number) => `${num(mm2 / 1e6, 2)} m²`;

/** PDF A4 de pé com chapas por material, fita de borda e lista de chapas. */
export async function pdfRelatorio(d: DadosSaida): Promise<Uint8Array> {
  const r = relatorioMaterial(d);
  const doc = await PDFDocument.create();
  doc.setTitle(`Relatório de material - ${d.projeto.nome}`);
  doc.setCreator('pro-cutter');
  const f = await carregarFontes(doc);
  const [W, H] = PageSizes.A4;
  const M = 15 * MM;
  let pag = doc.addPage([W, H]);
  let y = H - M;

  const texto = (t: string, x: number, tam = 9, negrito = false, cor = COR.texto) =>
    pag.drawText(textoSeguro(negrito ? f.negrito : f.normal, t), {
      x,
      y,
      size: tam,
      font: negrito ? f.negrito : f.normal,
      color: cor,
    });
  const novaLinha = (alt: number) => {
    y -= alt;
    if (y < M + 20) {
      pag = doc.addPage([W, H]);
      y = H - M;
    }
  };

  texto('Relatório de material', M, 16, true);
  novaLinha(18);
  texto(
    `${d.projeto.nome}  ·  ${d.projeto.cliente}  ·  plano v${d.plano.versao} de ${d.plano.criadoEm.toLocaleDateString('pt-BR')}`,
    M,
    9,
    false,
    COR.suave,
  );
  novaLinha(26);

  // Chapas por material
  texto('Chapas', M, 11, true);
  novaLinha(16);
  const colsChapa = [M, M + 185, M + 230, M + 355, M + 440];
  tabela(
    pag,
    f,
    y,
    colsChapa,
    ['Material', 'Chapas', 'Peças / chapa', 'Aproveitamento', 'Sobra útil'],
    true,
  );
  novaLinha(14);
  for (const m of r.materiais) {
    tabela(pag, f, y, colsChapa, [
      m.descricao,
      String(m.chapas),
      `${m2(m.areaPecas)} / ${m2(m.areaChapa)}`,
      porcentagem(m.aproveitamento),
      m2(m.sobraUtil),
    ]);
    novaLinha(13);
  }
  pag.drawLine({
    start: { x: M, y: y + 9 },
    end: { x: W - M, y: y + 9 },
    thickness: 0.5,
    color: COR.borda,
  });
  tabela(
    pag,
    f,
    y,
    colsChapa,
    [
      'Total',
      String(r.total.chapas),
      `${m2(r.total.areaPecas)} / ${m2(r.total.areaChapa)}`,
      porcentagem(r.total.aproveitamento),
      m2(r.total.sobraUtil),
    ],
    true,
  );
  novaLinha(28);

  // Fita
  texto('Fita de borda', M, 11, true);
  novaLinha(16);
  if (r.fita.length === 0) {
    texto('Nenhuma peça com fita.', M, 9, false, COR.suave);
    novaLinha(14);
  } else {
    const colsFita = [M, M + 250, M + 330, M + 410];
    tabela(
      pag,
      f,
      y,
      colsFita,
      ['Cor (material)', 'Espessura', 'Metros', `Comprar (+${FOLGA_FITA * 100}%)`],
      true,
    );
    novaLinha(14);
    for (const c of r.fita) {
      tabela(pag, f, y, colsFita, [
        c.descricao,
        `${num(c.espessura, 2)} mm`,
        `${num(c.metros, 1)} m`,
        `${c.comFolga} m`,
      ]);
      novaLinha(13);
    }
  }
  novaLinha(15);

  // Lista de chapas
  texto('Chapas do plano', M, 11, true);
  novaLinha(16);
  const colsLista = [M, M + 50, M + 300, M + 360];
  tabela(pag, f, y, colsLista, ['Nº', 'Material', 'Peças', 'Aproveitamento'], true);
  novaLinha(14);
  for (const c of r.chapas) {
    tabela(pag, f, y, colsLista, [
      String(c.numero),
      c.descricao,
      String(c.pecas),
      porcentagem(c.aproveitamento),
    ]);
    novaLinha(13);
  }

  return doc.save();
}

function tabela(
  pag: PDFPage,
  f: Fontes,
  y: number,
  xs: number[],
  celulas: string[],
  negrito = false,
) {
  celulas.forEach((t, i) => {
    const largura = (xs[i + 1] ?? xs[i]! + 120) - xs[i]! - 6;
    const fonte = negrito ? f.negrito : f.normal;
    pag.drawText(caber(fonte, t, 9, largura), {
      x: xs[i]!,
      y,
      size: 9,
      font: fonte,
      color: negrito ? COR.texto : COR.texto,
    });
  });
}
