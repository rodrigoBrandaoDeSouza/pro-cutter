import {
  ErroExportacao,
  gerarZipProg,
  pdfDesenho,
  pdfEtiquetas,
  pdfRelatorio,
} from '@pro-cutter/saidas';
import { dadosDoPlano } from '@/lib/server/saidas';
import { dbDoUsuario } from '@/lib/server/sessao';

const ARQUIVOS = {
  'prog.zip': { tipo: 'application/zip', sufixo: 'CVL.zip' },
  'desenho.pdf': { tipo: 'application/pdf', sufixo: 'desenho das chapas.pdf' },
  'etiquetas.pdf': { tipo: 'application/pdf', sufixo: 'etiquetas.pdf' },
  'relatorio.pdf': { tipo: 'application/pdf', sufixo: 'relatório de material.pdf' },
} as const;
type Arquivo = keyof typeof ARQUIVOS;

/** Content-Disposition com nome ASCII (navegadores antigos) e UTF-8 (acentos). */
function anexo(nome: string, inline = false): string {
  const ascii = nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_');
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`;
}

export async function GET(
  req: Request,
  ctx: RouteContext<'/projetos/[id]/plano/[versao]/[arquivo]'>,
) {
  const { db } = await dbDoUsuario();
  const { id, versao, arquivo } = await ctx.params;
  if (!(arquivo in ARQUIVOS)) return new Response('Arquivo desconhecido.', { status: 404 });
  const d = await dadosDoPlano(db, id, Number(versao));
  if (!d) return new Response('Plano não encontrado.', { status: 404 });

  let bytes: Uint8Array;
  try {
    switch (arquivo as Arquivo) {
      case 'prog.zip':
        bytes = gerarZipProg(d).bytes;
        break;
      case 'desenho.pdf':
        bytes = await pdfDesenho(d);
        break;
      case 'etiquetas.pdf':
        bytes = await pdfEtiquetas(d);
        break;
      case 'relatorio.pdf':
        bytes = await pdfRelatorio(d);
        break;
    }
  } catch (e) {
    if (e instanceof ErroExportacao) {
      return new Response(
        `Download bloqueado: a conferência dos arquivos .prog falhou (${e.detalhes.join('; ')}).`,
        {
          status: 409,
        },
      );
    }
    throw e;
  }

  const { tipo, sufixo } = ARQUIVOS[arquivo as Arquivo];
  return new Response(Buffer.from(bytes), {
    headers: {
      'Content-Type': tipo,
      // ?inline=1 abre no navegador (para imprimir) em vez de baixar
      'Content-Disposition': anexo(
        `${d.projeto.nome} - plano v${d.plano.versao} - ${sufixo}`,
        tipo === 'application/pdf' && new URL(req.url).searchParams.get('inline') === '1',
      ),
      'Cache-Control': 'private, no-store',
      'X-Plano-Atual': d.atual ? '1' : '0',
    },
  });
}
