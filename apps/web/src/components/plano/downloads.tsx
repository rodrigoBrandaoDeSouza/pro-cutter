'use client';

import { useState } from 'react';
import { ChevronDown, Download, FileText, Loader2, Printer, Tags, Table2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Arquivo = 'prog.zip' | 'desenho.pdf' | 'etiquetas.pdf' | 'relatorio.pdf';

/** Nome do arquivo a partir do Content-Disposition (preferindo o UTF-8). */
function nomeDoCabecalho(cd: string | null, padrao: string): string {
  const utf8 = cd?.match(/filename\*=UTF-8''([^;]+)/)?.[1];
  if (utf8) return decodeURIComponent(utf8);
  return cd?.match(/filename="([^"]+)"/)?.[1] ?? padrao;
}

const IMPRESSOS = [
  { arquivo: 'desenho.pdf', rotulo: 'Desenho das chapas', icone: FileText },
  { arquivo: 'etiquetas.pdf', rotulo: 'Etiquetas', icone: Tags },
  { arquivo: 'relatorio.pdf', rotulo: 'Relatório de material', icone: Table2 },
] as const;

/** Tablet e celular não imprimem PDF de dentro de um iframe: lá o PDF abre numa aba nova. */
function ehMovel() {
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|Android|Mobile/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  );
}

/**
 * Imprime o PDF sem baixar: no computador carrega num iframe invisível e abre a janela de
 * impressão; no tablet abre o PDF numa aba nova, onde fica o botão de imprimir do navegador.
 */
export function Imprimir({ projetoId, versao }: { projetoId: string; versao: number }) {
  const [preparando, setPreparando] = useState(false);

  const imprimir = (arquivo: (typeof IMPRESSOS)[number]['arquivo']) => {
    const url = `/projetos/${projetoId}/plano/${versao}/${arquivo}?inline=1`;
    if (ehMovel()) {
      // precisa ser síncrono no clique, senão o bloqueador de pop-up impede
      if (!window.open(url, '_blank'))
        toast.error('Libere pop-ups para este site e tente de novo.');
      return;
    }
    setPreparando(true);
    document.getElementById('pc-impressao')?.remove();
    const quadro = document.createElement('iframe');
    quadro.id = 'pc-impressao';
    quadro.title = 'Impressão';
    quadro.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    quadro.src = url;
    quadro.onload = () => {
      setPreparando(false);
      try {
        quadro.contentWindow?.focus();
        quadro.contentWindow?.print();
      } catch {
        window.open(url, '_blank');
      }
    };
    document.body.append(quadro);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" disabled={preparando} />}>
        {preparando ? <Loader2 className="animate-spin" /> : <Printer />} Imprimir
        <ChevronDown className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {IMPRESSOS.map(({ arquivo, rotulo, icone: Icone }) => (
          <DropdownMenuItem key={arquivo} onClick={() => imprimir(arquivo)}>
            <Icone /> {rotulo}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Baixa pelo fetch (e não por link direto) para mostrar o erro na tela quando a conferência dos .prog
 * bloqueia o download, em vez de salvar um arquivo de erro.
 */
export function Downloads({
  projetoId,
  versao,
  desatualizado,
}: {
  projetoId: string;
  versao: number;
  desatualizado: boolean;
}) {
  const [baixando, setBaixando] = useState<Arquivo | null>(null);

  const baixar = async (arquivo: Arquivo) => {
    setBaixando(arquivo);
    try {
      const r = await fetch(`/projetos/${projetoId}/plano/${versao}/${arquivo}`);
      if (!r.ok) {
        toast.error(await r.text());
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeDoCabecalho(r.headers.get('Content-Disposition'), arquivo);
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      if (r.headers.get('X-Plano-Atual') === '0') {
        toast.warning('Atenção: este plano está desatualizado em relação às peças do projeto.');
      } else if (arquivo === 'prog.zip') {
        toast.success(
          'Arquivos conferidos. Descompacte o ZIP na pasta compartilhada da seccionadora.',
        );
      }
    } catch {
      toast.error('Não foi possível baixar. Verifique a conexão e tente de novo.');
    } finally {
      setBaixando(null);
    }
  };

  return (
    <div className="flex">
      <Button
        onClick={() => baixar('prog.zip')}
        disabled={!!baixando}
        variant={desatualizado ? 'outline' : 'default'}
        className="rounded-r-none"
      >
        {baixando === 'prog.zip' ? <Loader2 className="animate-spin" /> : <Download />} Baixar ZIP
        (CVL)
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant={desatualizado ? 'outline' : 'default'}
              size="icon"
              className="rounded-l-none border-l border-l-primary-foreground/25"
              aria-label="Outros arquivos do plano"
              disabled={!!baixando}
            />
          }
        >
          {baixando && baixando !== 'prog.zip' ? (
            <Loader2 className="animate-spin" />
          ) : (
            <ChevronDown />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onClick={() => baixar('desenho.pdf')}>
            <FileText /> Desenho das chapas (PDF)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => baixar('etiquetas.pdf')}>
            <Tags /> Etiquetas (PDF)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => baixar('relatorio.pdf')}>
            <Table2 /> Relatório de material (PDF)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
