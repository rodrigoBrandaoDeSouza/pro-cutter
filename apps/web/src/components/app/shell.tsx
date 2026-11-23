'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTheme } from 'next-themes';
import {
  FolderKanban,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Settings,
  Sun,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from 'cn';
import { sairAction } from '@/app/entrar/actions';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Logo } from './logo';

export interface UsuarioShell {
  nome: string;
  email: string;
  papel: 'ADMIN' | 'USUARIO';
}

interface ItemNav {
  href: string;
  rotulo: string;
  icone: LucideIcon;
  admin?: boolean;
}

const NAV: ItemNav[] = [
  { href: '/projetos', rotulo: 'Projetos', icone: FolderKanban },
  { href: '/clientes', rotulo: 'Clientes', icone: Users },
  { href: '/configuracoes', rotulo: 'Configurações', icone: Settings, admin: true },
  { href: '/usuarios', rotulo: 'Usuários', icone: UserCog, admin: true },
];

export function Shell({ usuario, children }: { usuario: UsuarioShell; children: React.ReactNode }) {
  const [menuAberto, setMenuAberto] = useState(false);
  const itens = NAV.filter((i) => !i.admin || usuario.papel === 'ADMIN');

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r bg-sidebar lg:flex">
        <div className="px-5 py-5">
          <Link href="/projetos">
            <Logo />
          </Link>
        </div>
        <Navegacao itens={itens} />
        <div className="mt-auto border-t p-3">
          <MenuUsuario usuario={usuario} />
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur lg:hidden">
        <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
          <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Abrir menu" />}>
            <Menu />
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-sidebar p-0">
            <SheetTitle className="px-5 pt-5">
              <Logo />
            </SheetTitle>
            <Navegacao itens={itens} aoNavegar={() => setMenuAberto(false)} />
          </SheetContent>
        </Sheet>
        <Link href="/projetos" className="mr-auto">
          <Logo />
        </Link>
        <MenuUsuario usuario={usuario} compacto />
      </header>

      <main className="min-w-0">{children}</main>
    </div>
  );
}

function Navegacao({ itens, aoNavegar }: { itens: ItemNav[]; aoNavegar?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 px-3 py-2" aria-label="Principal">
      {itens.map(({ href, rotulo, icone: Icone }) => {
        const ativo = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={aoNavegar}
            aria-current={ativo ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              ativo
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
            )}
          >
            <Icone className={cn('size-4', ativo && 'text-primary')} />
            {rotulo}
          </Link>
        );
      })}
    </nav>
  );
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return (
    (partes[0]?.[0] ?? '') + (partes.length > 1 ? (partes.at(-1)?.[0] ?? '') : '')
  ).toUpperCase();
}

function MenuUsuario({ usuario, compacto }: { usuario: UsuarioShell; compacto?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [saindo, iniciar] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Menu do usuário"
            className={cn(
              'flex items-center gap-3 rounded-lg text-left outline-none transition-colors hover:bg-sidebar-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50',
              compacto ? 'p-1' : 'w-full p-2',
            )}
          />
        }
      >
        <Avatar className="size-8">
          <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
            {iniciais(usuario.nome)}
          </AvatarFallback>
        </Avatar>
        {!compacto && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{usuario.nome}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {usuario.papel === 'ADMIN' ? 'Administrador' : 'Usuário'}
            </span>
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compacto ? 'end' : 'start'} className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block truncate font-medium text-foreground">{usuario.nome}</span>
            <span className="block truncate text-xs font-normal">{usuario.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Tema</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={theme ?? 'system'}
            onValueChange={(v) => setTheme(String(v))}
          >
            <DropdownMenuRadioItem value="light">
              <Sun /> Claro
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">
              <Moon /> Escuro
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">
              <Monitor /> Automático
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={saindo} onClick={() => iniciar(() => sairAction())}>
          <LogOut /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
