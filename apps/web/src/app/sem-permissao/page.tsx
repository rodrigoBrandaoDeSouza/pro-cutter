import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { EstadoVazio } from '@/components/app/cabecalho';
import { buttonVariants } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Sem permissão' };

export default function SemPermissao() {
  return (
    <main className="flex min-h-dvh items-center">
      <EstadoVazio
        icone={<ShieldAlert />}
        titulo="Sem permissão"
        descricao="Esta área é só para administradores. Peça acesso ao administrador da sua marcenaria."
        acao={
          <Link href="/projetos" className={buttonVariants()}>
            Voltar para Projetos
          </Link>
        }
      />
    </main>
  );
}
