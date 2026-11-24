import { cn } from 'cn';

/** Bloco com título, descrição e ação à direita, usado nas telas de configuração. */
export function Secao({
  titulo,
  descricao,
  acao,
  className,
  children,
}: {
  titulo: string;
  descricao?: React.ReactNode;
  acao?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn('rounded-xl border bg-card', className)}>
      <header className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">{titulo}</h2>
          {descricao && <p className="mt-0.5 text-sm text-muted-foreground">{descricao}</p>}
        </div>
        {acao}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

/** Número em mm no padrão brasileiro (vírgula decimal). */
export function mmBR(v: number): string {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}
