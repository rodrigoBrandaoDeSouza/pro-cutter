import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/app/logo';
import { obterUsuario } from '@/lib/server/sessao';
import { FormEntrar } from './form-entrar';

export const metadata: Metadata = { title: 'Entrar' };

export default async function PaginaEntrar({ searchParams }: PageProps<'/entrar'>) {
  if (await obterUsuario()) redirect('/projetos');
  const { de } = await searchParams;

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Logo className="mb-10" />
          <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Use o e-mail e a senha cadastrados pela sua marcenaria.
          </p>
          <FormEntrar de={typeof de === 'string' ? de : undefined} />
        </div>
      </section>
      <aside className="relative hidden overflow-hidden bg-sidebar lg:block" aria-hidden>
        <IlustracaoChapa />
      </aside>
    </main>
  );
}

/** Ilustração de uma chapa com o plano de corte, só decorativa. */
function IlustracaoChapa() {
  const pecas = [
    [6, 6, 44, 20],
    [52, 6, 26, 20],
    [80, 6, 14, 20],
    [6, 28, 30, 30],
    [38, 28, 30, 14],
    [38, 44, 30, 14],
    [70, 28, 24, 30],
    [6, 60, 58, 14],
    [66, 60, 28, 14],
  ];
  return (
    <div className="absolute inset-0 flex items-center justify-center p-16">
      <div className="w-full max-w-lg">
        <svg viewBox="0 0 100 80" className="w-full drop-shadow-xl">
          <rect
            x="0"
            y="0"
            width="100"
            height="80"
            rx="2"
            className="fill-card stroke-border"
            strokeWidth="0.4"
          />
          {pecas.map(([x, y, w, h], i) => (
            <rect
              key={i}
              x={x}
              y={y}
              width={w}
              height={h}
              rx="0.8"
              className={
                i % 3 === 0
                  ? 'fill-primary/80'
                  : i % 3 === 1
                    ? 'fill-primary/45'
                    : 'fill-primary/25'
              }
            />
          ))}
        </svg>
        <p className="mt-8 text-center text-lg font-medium text-sidebar-foreground">
          Do Promob à seccionadora, sem retrabalho.
        </p>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Importe o projeto, otimize as chapas e envie o corte direto para a máquina.
        </p>
      </div>
    </div>
  );
}
