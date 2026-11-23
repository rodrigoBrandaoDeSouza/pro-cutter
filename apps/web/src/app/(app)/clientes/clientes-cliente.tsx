'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Pencil, Phone, Plus, Search } from 'lucide-react';
import { BotaoExcluir } from '@/components/app/confirmar';
import { Campo, useAcao } from '@/components/app/form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatarTelefone } from '@/lib/telefone';
import { excluirCliente, salvarCliente, type ClienteSalvo } from './actions';

export interface ClienteLista {
  id: string;
  nome: string;
  telefone: string;
  projetos: number;
}

/** Busca que atualiza a URL (?q=) enquanto digita, com pequeno atraso. */
export function Busca({ inicial }: { inicial: string }) {
  const [q, setQ] = useState(inicial);
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (q === inicial) return;
    const t = setTimeout(() => {
      router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname);
    }, 250);
    return () => clearTimeout(t);
  }, [q, inicial, pathname, router]);

  return (
    <div className="relative max-w-sm">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Buscar por nome ou telefone"
        aria-label="Buscar clientes"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="pl-8"
      />
    </div>
  );
}

export function ListaClientes({ clientes, busca }: { clientes: ClienteLista[]; busca: string }) {
  if (clientes.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Nenhum cliente encontrado para “{busca}”.
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Projetos</TableHead>
            <TableHead className="w-24">
              <span className="sr-only">Ações</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clientes.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.nome}</TableCell>
              <TableCell>
                {c.telefone ? (
                  <a
                    href={`tel:+55${c.telefone}`}
                    className="inline-flex items-center gap-1.5 hover:text-primary"
                  >
                    <Phone className="size-3.5 text-muted-foreground" />
                    {formatarTelefone(c.telefone)}
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="hidden text-right tabular-nums sm:table-cell">
                {c.projetos}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <DialogoCliente cliente={c} />
                  <BotaoExcluir
                    rotulo={`Excluir ${c.nome}`}
                    titulo={`Excluir ${c.nome}?`}
                    bloqueio={
                      c.projetos > 0
                        ? `Este cliente tem ${c.projetos} projeto(s) e não pode ser excluído.`
                        : undefined
                    }
                    acao={() => excluirCliente(c.id)}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Sem `cliente`: botão "Novo cliente". Com `cliente`: botão de editar.
 * `aoSalvar` permite usar o diálogo dentro de outro formulário (ex.: novo projeto).
 */
export function DialogoCliente({
  cliente,
  nomeInicial,
  aoSalvar,
  gatilho,
}: {
  cliente?: ClienteLista;
  nomeInicial?: string;
  aoSalvar?: (c: ClienteSalvo) => void;
  gatilho?: React.ReactElement;
}) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const { executar, pendente, erros, limparErros } = useAcao(salvarCliente, {
    aoConcluir: (c) => {
      setAberto(false);
      aoSalvar?.(c);
    },
  });

  const abrir = (v: boolean) => {
    setAberto(v);
    if (v) {
      limparErros();
      setNome(cliente?.nome ?? nomeInicial ?? '');
      setTelefone(cliente ? formatarTelefone(cliente.telefone) : '');
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={abrir}>
      <DialogTrigger
        render={
          gatilho ??
          (cliente ? (
            <Button variant="ghost" size="icon" aria-label={`Editar ${cliente.nome}`} />
          ) : (
            <Button />
          ))
        }
      >
        {gatilho ? undefined : cliente ? (
          <Pencil />
        ) : (
          <>
            <Plus /> Novo cliente
          </>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            executar({ id: cliente?.id, nome, telefone });
          }}
          className="space-y-5"
        >
          <DialogHeader>
            <DialogTitle>{cliente ? 'Editar cliente' : 'Novo cliente'}</DialogTitle>
            <DialogDescription>Só o essencial: nome e telefone.</DialogDescription>
          </DialogHeader>
          <Campo id="c-nome" rotulo="Nome" erro={erros.nome}>
            <Input
              id="c-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              aria-invalid={!!erros.nome}
              autoFocus
            />
          </Campo>
          <Campo id="c-telefone" rotulo="Telefone" erro={erros.telefone} dica="Opcional, com DDD.">
            <Input
              id="c-telefone"
              type="tel"
              inputMode="tel"
              placeholder="(45) 99999-9999"
              value={telefone}
              onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
              aria-invalid={!!erros.telefone}
            />
          </Campo>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pendente}>
              {cliente ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
