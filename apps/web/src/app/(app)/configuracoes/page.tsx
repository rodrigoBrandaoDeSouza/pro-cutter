import type { Metadata } from 'next';
import { Settings } from 'lucide-react';
import { Cabecalho, EstadoVazio } from '@/components/app/cabecalho';
import { exigirAdmin } from '@/lib/server/sessao';

export const metadata: Metadata = { title: 'Configurações' };

export default async function PaginaConfiguracoes() {
  await exigirAdmin();
  return (
    <>
      <Cabecalho
        titulo="Configurações"
        descricao="Materiais, máquina, regras e fórmulas da marcenaria."
      />
      <EstadoVazio
        icone={<Settings />}
        titulo="Em construção"
        descricao="Chega na próxima etapa."
      />
    </>
  );
}
