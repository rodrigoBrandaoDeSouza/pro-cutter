import type { Metadata } from 'next';
import { FolderKanban, Plus } from 'lucide-react';
import { Cabecalho, EstadoVazio } from '@/components/app/cabecalho';
import { Button } from '@/components/ui/button';
import { exigirUsuario } from '@/lib/server/sessao';

export const metadata: Metadata = { title: 'Projetos' };

export default async function PaginaProjetos() {
  await exigirUsuario();
  return (
    <>
      <Cabecalho
        titulo="Projetos"
        descricao="Cada projeto reúne os ambientes do Promob, as peças e o plano de corte."
        acao={
          <Button disabled>
            <Plus /> Novo projeto
          </Button>
        }
      />
      <EstadoVazio
        icone={<FolderKanban />}
        titulo="Nenhum projeto ainda"
        descricao="Crie um projeto e importe o XML do Promob para começar."
      />
    </>
  );
}
