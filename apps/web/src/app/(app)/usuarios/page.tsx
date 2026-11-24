import type { Metadata } from 'next';
import { daEmpresa } from '@pro-cutter/db';
import { Cabecalho } from '@/components/app/cabecalho';
import { prisma } from '@/lib/server/db';
import { exigirAdmin } from '@/lib/server/sessao';
import { DialogoUsuario, ListaUsuarios } from './usuarios-cliente';

export const metadata: Metadata = { title: 'Usuários' };

export default async function PaginaUsuarios() {
  const admin = await exigirAdmin();
  const usuarios = await daEmpresa(prisma, admin.empresaId).usuario.findMany({
    orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    select: { id: true, nome: true, email: true, papel: true, ativo: true, criadoEm: true },
  });

  return (
    <>
      <Cabecalho
        titulo="Usuários"
        descricao="Quem acessa o pro-cutter e com qual permissão."
        acao={<DialogoUsuario />}
      />
      <div className="px-4 py-6 sm:px-8">
        <ListaUsuarios
          usuarios={usuarios.map((u) => ({ ...u, criadoEm: u.criadoEm.toISOString() }))}
          meuId={admin.id}
        />
      </div>
    </>
  );
}
