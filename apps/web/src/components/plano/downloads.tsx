'use client';

import { useState } from 'react';
import { ChevronDown, Download, FileText, Loader2, Tags, Table2 } from 'lucide-react';
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
