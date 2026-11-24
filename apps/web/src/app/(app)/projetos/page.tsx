import type { Metadata } from 'next';
import Link from 'next/link';
import { FolderKanban } from 'lucide-react';
import { cn } from 'cn';
import { Cabecalho, EstadoVazio } from '@/components/app/cabecalho';
import { quando, SeloStatus } from '@/components/app/status';
import { dbDoUsuario } from '@/lib/server/sessao';
import { ROTULO_STATUS, STATUS, type Status } from '@/lib/status';
import { Busca } from '@/components/app/busca';
import { DialogoNovoProjeto } from './novo-projeto';

export const metadata: Metadata = { title: 'Projetos' };

export default async function PaginaProjetos({ searchParams }: PageProps<'/projetos'>) {
  const { db } = await dbDoUsuario();
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.trim() : '';
  const status = STATUS.includes(sp.status as Status) ? (sp.status as Status) : undefined;

  const filtroBusca = q
    ? {
        OR: [
          { nome: { contains: q, mode: 'insensitive' as const } },
          { cliente: { nome: { contains: q, mode: 'insensitive' as const } } },
        ],
      }
    : {};

  const [projetos, contagens, total, clientes] = await Promise.all([
    db.projeto.findMany({
      where: { ...filtroBusca, ...(status ? { status } : {}) },
      orderBy: { atualizadoEm: 'desc' },
      include: { cliente: { select: { nome: true } }, _count: { select: { ambientes: true } } },
      take: 200,
    }),
    db.projeto.groupBy({ by: ['status'], where: filtroBusca, _count: true }),
    db.projeto.count(),
    db.cliente.findMany({ orderBy: { nome: 'asc' }, select: { id: true, nome: true } }),
  ]);
  const porStatus = Object.fromEntries(contagens.map((c) => [c.status, c._count])) as Partial<
    Record<Status, number>
  >;
  const href = (s?: Status) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (s) p.set('status', s);
    const t = p.toString();
    return t ? `/projetos?${t}` : '/projetos';
  };

  return (
    <>
      <Cabecalho
        titulo="Projetos"
        descricao="Cada projeto reúne os ambientes do Promob, as peças e o plano de corte."
        acao={<DialogoNovoProjeto clientes={clientes} />}
      />
      <div className="space-y-4 px-4 py-6 sm:px-8">
        {total === 0 ? (
          <EstadoVazio
            icone={<FolderKanban />}
            titulo="Nenhum projeto ainda"
            descricao="Crie um projeto e importe o XML do Promob para começar."
            acao={<DialogoNovoProjeto clientes={clientes} />}
          />
        ) : (
          <>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <Busca
                inicial={q}
                rotulo="Buscar projetos"
                placeholder="Buscar por projeto ou cliente"
              />
              <nav
                aria-label="Filtrar por status"
                className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
              >
                <FiltroStatus
                  href={href()}
                  ativo={!status}
                  rotulo="Todos"
                  n={Object.values(porStatus).reduce((a, b) => a + (b ?? 0), 0)}
                />
                {STATUS.map((s) => (
                  <FiltroStatus
                    key={s}
                    href={href(s)}
                    ativo={status === s}
                    rotulo={ROTULO_STATUS[s]}
                    n={porStatus[s] ?? 0}
                  />
                ))}
              </nav>
            </div>

            {projetos.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Nenhum projeto com esses filtros.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {projetos.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/projetos/${p.id}`}
                      className="group flex h-full flex-col rounded-xl border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="truncate font-semibold group-hover:text-primary">
                            {p.nome}
                          </h2>
                          <p className="truncate text-sm text-muted-foreground">{p.cliente.nome}</p>
                        </div>
                        <SeloStatus status={p.status} />
                      </div>
                      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {p._count.ambientes === 0
                            ? 'Sem ambientes'
                            : `${p._count.ambientes} ambiente${p._count.ambientes > 1 ? 's' : ''}`}
                        </span>
                        <span>Atualizado {quando(p.atualizadoEm.toISOString())}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </>
  );
}

function FiltroStatus({
  href,
  ativo,
  rotulo,
  n,
}: {
  href: string;
  ativo: boolean;
  rotulo: string;
  n: number;
}) {
  return (
    <Link
      href={href}
      aria-current={ativo ? 'page' : undefined}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors',
        ativo ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
      )}
    >
      {rotulo}
      <span className={cn('tabular-nums', ativo ? 'opacity-80' : 'text-muted-foreground')}>
        {n}
      </span>
    </Link>
  );
}
