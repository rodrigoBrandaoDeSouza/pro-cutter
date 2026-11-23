import type { Metadata } from 'next';
import { UserCog } from 'lucide-react';
import { Cabecalho, EstadoVazio } from '@/components/app/cabecalho';
import { exigirAdmin } from '@/lib/server/sessao';

export const metadata: Metadata = { title: 'Usuários' };

export default async function PaginaUsuarios() {
  await exigirAdmin();
  return (
    <>
      <Cabecalho titulo="Usuários" descricao="Quem acessa o pro-cutter e com qual permissão." />
      <EstadoVazio icone={<UserCog />} titulo="Em construção" descricao="Chega na próxima etapa." />
    </>
  );
}
