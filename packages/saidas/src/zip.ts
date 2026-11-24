import { strToU8, zipSync } from 'fflate';
import { exportarPlano, verificarExportacao } from '@pro-cutter/cvl';
import type { DadosSaida } from './dados.ts';

export class ErroExportacao extends Error {
  constructor(readonly detalhes: string[]) {
    super(`Exportação bloqueada: ${detalhes.join('; ')}`);
    this.name = 'ErroExportacao';
  }
}

/**
 * Gera os .prog da CVL (um por chapa) e empacota em ZIP. Antes, relê cada arquivo e confere com o plano:
 * qualquer divergência bloqueia o download (ErroExportacao).
 */
export function gerarZipProg(d: DadosSaida): { bytes: Uint8Array; arquivos: string[] } {
  const materiais = Object.fromEntries(
    d.plano.materiais.map((m) => [
      m.id,
      {
        materialTexto: d.textoProg[m.id] ?? `MDF-${m.espessura}-${m.descricao}`,
        espessura: m.espessura,
        descricao: m.descricao,
      },
    ]),
  );
  const plano = { chapas: d.plano.chapas };
  const arquivos = exportarPlano(plano, { projeto: d.projeto.nome, materiais });
  const erros = verificarExportacao(plano, arquivos, { serra: d.plano.parametros.serra });
  if (erros.length) throw new ErroExportacao(erros.map((e) => e.mensagem));

  const bytes = zipSync(Object.fromEntries(arquivos.map((a) => [a.nome, strToU8(a.conteudo)])), {
    level: 6,
    mtime: d.plano.criadoEm,
  });
  return { bytes, arquivos: arquivos.map((a) => a.nome) };
}
