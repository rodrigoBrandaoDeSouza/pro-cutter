import { Shell } from '@/components/app/shell';
import { exigirUsuario } from '@/lib/server/sessao';

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario();
  return (
    <Shell usuario={{ nome: usuario.nome, email: usuario.email, papel: usuario.papel }}>
      {children}
    </Shell>
  );
}
