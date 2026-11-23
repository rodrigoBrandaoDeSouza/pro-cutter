import type { Metadata } from 'next';
import { Users } from 'lucide-react';
import { Cabecalho, EstadoVazio } from '@/components/app/cabecalho';
import { exigirUsuario } from '@/lib/server/sessao';

export const metadata: Metadata = { title: 'Clientes' };

export default async function PaginaClientes() {
  await exigirUsuario();
  return (
    <>
      <Cabecalho titulo="Clientes" descricao="Nome e telefone de quem encomendou cada projeto." />
      <EstadoVazio icone={<Users />} titulo="Nenhum cliente ainda" descricao="Em breve." />
    </>
  );
}
