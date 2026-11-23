'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, UserPlus } from 'lucide-react';
import { Campo, SelectNativo, useAcao } from '@/components/app/form';
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
import { DialogoCliente } from '../clientes/clientes-cliente';
import { criarProjeto } from './actions';

export function DialogoNovoProjeto({
  clientes: iniciais,
}: {
  clientes: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [clientes, setClientes] = useState(iniciais);
  const [f, setF] = useState({ nome: '', clienteId: '', observacoes: '' });
  const { executar, pendente, erros, limparErros } = useAcao(criarProjeto, {
    aoConcluir: ({ id }) => {
      setAberto(false);
      router.push(`/projetos/${id}`);
    },
  });

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        if (v) {
          limparErros();
          setClientes(iniciais);
          setF({ nome: '', clienteId: '', observacoes: '' });
        }
      }}
    >
      <DialogTrigger render={<Button />}>
        <Plus /> Novo projeto
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            executar(f);
          }}
        >
          <DialogHeader>
            <DialogTitle>Novo projeto</DialogTitle>
            <DialogDescription>
              Depois de criar, importe os XMLs do Promob (um por ambiente).
            </DialogDescription>
          </DialogHeader>
          <Campo id="p-nome" rotulo="Nome do projeto" erro={erros.nome}>
            <Input
              id="p-nome"
              placeholder="Ex.: Cozinha e área de serviço"
              value={f.nome}
              onChange={(e) => setF({ ...f, nome: e.target.value })}
              aria-invalid={!!erros.nome}
              autoFocus
            />
          </Campo>
          <Campo id="p-cliente" rotulo="Cliente" erro={erros.clienteId}>
            <div className="flex gap-2">
              <SelectNativo
                id="p-cliente"
                value={f.clienteId}
                onChange={(e) => setF({ ...f, clienteId: e.target.value })}
                aria-invalid={!!erros.clienteId}
              >
                <option value="">Escolha o cliente…</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </SelectNativo>
              <DialogoCliente
                gatilho={
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Cadastrar cliente novo"
                  />
                }
                aoSalvar={(c) => {
                  setClientes([...clientes, c].sort((a, b) => a.nome.localeCompare(b.nome)));
                  setF((atual) => ({ ...atual, clienteId: c.id }));
                }}
              >
                <UserPlus />
              </DialogoCliente>
            </div>
          </Campo>
          <Campo id="p-obs" rotulo="Observações" dica="Opcional.">
            <textarea
              id="p-obs"
              rows={2}
              value={f.observacoes}
              onChange={(e) => setF({ ...f, observacoes: e.target.value })}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
          </Campo>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pendente}>
              Criar projeto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
