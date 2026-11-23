'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { cn } from 'cn';
import { Label } from '@/components/ui/label';
import type { Resultado } from '@/lib/acao';

/**
 * Executa uma ação do servidor com estado de envio, erros por campo e aviso (toast).
 * `aoConcluir` roda só no sucesso.
 */
export function useAcao<E, T>(
  acao: (entrada: E) => Promise<Resultado<T>>,
  opcoes: { sucesso?: string; aoConcluir?: (dados: T) => void } = {},
) {
  const [pendente, iniciar] = useTransition();
  const [erros, setErros] = useState<Record<string, string>>({});

  const executar = (entrada: E) =>
    iniciar(async () => {
      const r = await acao(entrada);
      if (r.ok) {
        setErros({});
        const msg = r.mensagem ?? opcoes.sucesso;
        if (msg) toast.success(msg);
        opcoes.aoConcluir?.(r.dados);
      } else {
        setErros(r.campos ?? {});
        toast.error(r.erro);
      }
    });

  return { executar, pendente, erros, limparErros: () => setErros({}) };
}

/** Rótulo + controle + dica/erro, com ligação acessível (aria-describedby). */
export function Campo({
  id,
  rotulo,
  erro,
  dica,
  className,
  children,
}: {
  id: string;
  rotulo: string;
  erro?: string;
  dica?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>{rotulo}</Label>
      {children}
      {erro ? (
        <p id={`${id}-erro`} className="text-xs text-destructive">
          {erro}
        </p>
      ) : (
        dica && <p className="text-xs text-muted-foreground">{dica}</p>
      )}
    </div>
  );
}

/** <select> nativo com o visual dos campos: ótimo em tablet e acessível. */
export function SelectNativo({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive dark:bg-input/30',
        className,
      )}
      {...props}
    />
  );
}
