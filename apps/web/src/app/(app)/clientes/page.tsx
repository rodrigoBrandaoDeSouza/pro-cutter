import type { Metadata } from 'next';
import { Users } from 'lucide-react';
import { Cabecalho, EstadoVazio } from '@/components/app/cabecalho';
import { dbDoUsuario } from '@/lib/server/sessao';
import { Busca } from '@/components/app/busca';
import { DialogoCliente, ListaClientes } from './clientes-cliente';

export const metadata: Metadata = { title: 'Clientes' };

export default async function PaginaClientes({ searchParams }: PageProps<'/clientes'>) {
  const { db } = await dbDoUsuario();
  const { q } = await searchParams;
  const busca = typeof q === 'string' ? q.trim() : '';
  const digitos = busca.replace(/\D/g, '');

  const clientes = await db.cliente.findMany({
    where: busca
      ? {
          OR: [
            { nome: { contains: busca, mode: 'insensitive' } },
            ...(digitos.length >= 3 ? [{ telefone: { contains: digitos } }] : []),
          ],
        }
      : undefined,
    orderBy: { nome: 'asc' },
    include: { _count: { select: { projetos: true } } },
    take: 200,
  });
  const total = busca ? await db.cliente.count() : clientes.length;

  return (
    <>
      <Cabecalho
        titulo="Clientes"
        descricao="Nome e telefone de quem encomendou cada projeto."
        acao={<DialogoCliente />}
      />
      <div className="space-y-4 px-4 py-6 sm:px-8">
        {total === 0 ? (
          <EstadoVazio
            icone={<Users />}
            titulo="Nenhum cliente ainda"
            descricao="Cadastre aqui ou direto ao criar um projeto."
          />
        ) : (
          <>
            <Busca
              inicial={busca}
              rotulo="Buscar clientes"
              placeholder="Buscar por nome ou telefone"
            />
            <ListaClientes
              clientes={clientes.map((c) => ({
                id: c.id,
                nome: c.nome,
                telefone: c.telefone,
                projetos: c._count.projetos,
              }))}
              busca={busca}
            />
          </>
        )}
      </div>
    </>
  );
}
