import { posicionar, type ChapaPlano, type Plano } from '@pro-cutter/core';
import { gerarProg } from './gerar.ts';
import { lerProg } from './ler.ts';

export interface MaterialExportacao {
  /** Atributo `material` do .prog (ex.: "MDF-15-Branco-MDF Branco 15mm"). */
  materialTexto: string;
  espessura: number;
  /** Usado no nome do arquivo (ex.: "MDF Branco 15mm"). */
  descricao: string;
}

export interface OpcoesExportacao {
  projeto: string;
  /** Por id de material. */
  materiais: Record<string, MaterialExportacao>;
}

export interface ArquivoProg {
  nome: string;
  conteudo: string;
  chapaNumero: number;
}

export interface ErroExportacao {
  chapa: number;
  mensagem: string;
}

/** `<projeto>-<material>.<nnn>.prog`, com caracteres inválidos para nome de arquivo trocados por "_". */
export function nomeArquivo(projeto: string, material: string, seq: number): string {
  // eslint-disable-next-line no-control-regex
  const limpar = (s: string) => s.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim();
  return `${limpar(projeto)}-${limpar(material)}.${String(seq).padStart(3, '0')}.prog`;
}

/** Um .prog por chapa, numerados na ordem do plano. */
export function exportarPlano(plano: Plano, op: OpcoesExportacao): ArquivoProg[] {
  return plano.chapas.map((chapa, i) => {
    const m = op.materiais[chapa.materialId];
    if (!m) throw new Error(`Material ${chapa.materialId} sem configuração de exportação`);
    return {
      nome: nomeArquivo(op.projeto, m.descricao, i + 1),
      conteudo: gerarProg(chapa, { materialTexto: m.materialTexto, espessura: m.espessura }),
      chapaNumero: chapa.numero,
    };
  });
}

/**
 * Relê cada arquivo gerado e confere se reconstrói exatamente as peças (posição e medida) da chapa do plano.
 * Qualquer divergência deve bloquear o download.
 */
export function verificarExportacao(
  plano: Plano,
  arquivos: ArquivoProg[],
  op: { serra: number },
): ErroExportacao[] {
  const erros: ErroExportacao[] = [];
  const porChapa = new Map(arquivos.map((a) => [a.chapaNumero, a]));

  for (const chapa of plano.chapas) {
    const arq = porChapa.get(chapa.numero);
    if (!arq) {
      erros.push({ chapa: chapa.numero, mensagem: `Chapa ${chapa.numero} sem arquivo .prog` });
      continue;
    }
    try {
      const lido = lerProg(arq.conteudo, chapa.numero).chapa;
      if (lido.comprimento !== chapa.comprimento || lido.largura !== chapa.largura) {
        erros.push({
          chapa: chapa.numero,
          mensagem: `${arq.nome}: tamanho da chapa diferente do plano`,
        });
        continue;
      }
      const esperado = assinatura(chapa, op.serra);
      const obtido = assinatura(lido, op.serra);
      if (esperado !== obtido) {
        erros.push({ chapa: chapa.numero, mensagem: `${arq.nome}: peças diferentes do plano` });
      }
    } catch (e) {
      erros.push({ chapa: chapa.numero, mensagem: `${arq.nome}: ${(e as Error).message}` });
    }
  }
  return erros;
}

function assinatura(chapa: ChapaPlano, serra: number): string {
  return posicionar(chapa, { serra, sobraMinima: { comprimento: 0, largura: 0 } })
    .pecas.map((p) => `${p.x},${p.y},${p.c},${p.l}`)
    .join(';');
}
