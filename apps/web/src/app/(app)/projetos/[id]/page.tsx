import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Phone } from 'lucide-react';
import { quando } from '@/components/app/status';
import { dbDoUsuario } from '@/lib/server/sessao';
import { formatarTelefone } from '@/lib/telefone';
import { AbasProjeto, AcoesProjeto, MenuStatus } from './projeto-cliente';

export async function generateMetadata({ params }: PageProps<'/projetos/[id]'>): Promise<Metadata> {
  const { db } = await dbDoUsuario();
  const p = await db.projeto.findUnique({
    where: { id: (await params).id },
    select: { nome: true },
  });
  return { title: p?.nome ?? 'Projeto' };
}

export default async function PaginaProjeto({ params }: PageProps<'/projetos/[id]'>) {
  const { usuario, db } = await dbDoUsuario();
  const { id } = await params;
  const projeto = await db.projeto.findUnique({
    where: { id },
    include: {
      cliente: true,
      historico: { orderBy: { em: 'desc' }, take: 50 },
      _count: { select: { ambientes: true } },
    },
  });
  if (!projeto) notFound();

  const [clientes, usuarios] = await Promise.all([
    db.cliente.findMany({ orderBy: { nome: 'asc' }, select: { id: true, nome: true } }),
    db.usuario.findMany({ select: { id: true, nome: true } }),
  ]);
  const nomeUsuario = new Map(usuarios.map((u) => [u.id, u.nome]));

  return (
    <>
      <div className="border-b px-4 pt-4 pb-6 sm:px-8">
        <Link
          href="/projetos"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Projetos
        </Link>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">{projeto.nome}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{projeto.cliente.nome}</span>
              {projeto.cliente.telefone && (
                <a
                  href={`tel:+55${projeto.cliente.telefone}`}
                  className="inline-flex items-center gap-1 hover:text-primary"
                >
                  <Phone className="size-3.5" /> {formatarTelefone(projeto.cliente.telefone)}
                </a>
              )}
              <span>Atualizado {quando(projeto.atualizadoEm.toISOString())}</span>
            </p>
            {projeto.observacoes && (
              <p className="mt-2 max-w-2xl text-sm whitespace-pre-line">{projeto.observacoes}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <MenuStatus id={projeto.id} status={projeto.status} />
            <AcoesProjeto
              projeto={{
                id: projeto.id,
                nome: projeto.nome,
                clienteId: projeto.clienteId,
                observacoes: projeto.observacoes,
              }}
              clientes={clientes}
              podeExcluir={usuario.papel === 'ADMIN'}
            />
          </div>
        </div>
      </div>
      <div className="px-4 py-6 sm:px-8">
        <AbasProjeto
          historico={projeto.historico.map((h) => ({
            id: h.id,
            de: h.de,
            para: h.para,
            em: h.em.toISOString(),
            usuario: nomeUsuario.get(h.usuarioId) ?? 'Usuário removido',
          }))}
        />
      </div>
    </>
  );
}
