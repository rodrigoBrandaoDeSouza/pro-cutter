'use client';

import { useState } from 'react';
import {
  Boxes,
  ChevronDown,
  FileUp,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  Scissors,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { EstadoVazio } from '@/components/app/cabecalho';
import { Campo, SelectNativo, useAcao } from '@/components/app/form';
import { quando, SeloStatus } from '@/components/app/status';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ROTULO_STATUS, STATUS, type Status } from '@/lib/status';
import { editarProjeto, excluirProjeto, mudarStatus } from '../actions';

export function MenuStatus({ id, status }: { id: string; status: Status }) {
  const { executar, pendente } = useAcao(mudarStatus);
  // No Base UI, item de rádio não fecha o menu sozinho
  const [aberto, setAberto] = useState(false);
  return (
    <DropdownMenu open={aberto} onOpenChange={setAberto}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            disabled={pendente}
            aria-label={`Status: ${ROTULO_STATUS[status]}`}
          />
        }
      >
        <SeloStatus status={status} className="-ml-1" />
        <ChevronDown className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuRadioGroup
          value={status}
          onValueChange={(v) => {
            setAberto(false);
            executar({ id, status: String(v) });
          }}
        >
          {STATUS.map((s) => (
            <DropdownMenuRadioItem key={s} value={s}>
              {ROTULO_STATUS[s]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface ProjetoEdicao {
  id: string;
  nome: string;
  clienteId: string;
  observacoes: string;
}

export function AcoesProjeto({
  projeto,
  clientes,
  podeExcluir,
}: {
  projeto: ProjetoEdicao;
  clientes: { id: string; nome: string }[];
  podeExcluir: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [f, setF] = useState(projeto);
  const edicao = useAcao(editarProjeto, { aoConcluir: () => setEditando(false) });
  const exclusao = useAcao(excluirProjeto);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" aria-label="Mais ações do projeto" />}
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={() => {
              setF(projeto);
              edicao.limparErros();
              setEditando(true);
            }}
          >
            <Pencil /> Editar dados
          </DropdownMenuItem>
          {podeExcluir && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setExcluindo(true)}>
                <Trash2 /> Excluir projeto
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editando} onOpenChange={setEditando}>
        <DialogContent className="sm:max-w-md">
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              edicao.executar(f);
            }}
          >
            <DialogHeader>
              <DialogTitle>Editar projeto</DialogTitle>
            </DialogHeader>
            <Campo id="ep-nome" rotulo="Nome do projeto" erro={edicao.erros.nome}>
              <Input
                id="ep-nome"
                value={f.nome}
                onChange={(e) => setF({ ...f, nome: e.target.value })}
              />
            </Campo>
            <Campo id="ep-cliente" rotulo="Cliente" erro={edicao.erros.clienteId}>
              <SelectNativo
                id="ep-cliente"
                value={f.clienteId}
                onChange={(e) => setF({ ...f, clienteId: e.target.value })}
              >
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </SelectNativo>
            </Campo>
            <Campo id="ep-obs" rotulo="Observações">
              <textarea
                id="ep-obs"
                rows={3}
                value={f.observacoes}
                onChange={(e) => setF({ ...f, observacoes: e.target.value })}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              />
            </Campo>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditando(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={edicao.pendente}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={excluindo} onOpenChange={setExcluindo}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {projeto.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Ambientes, peças e planos de corte deste projeto serão apagados. Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={exclusao.pendente}
              onClick={() => exclusao.executar(projeto.id)}
            >
              Excluir projeto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export interface ItemHistorico {
  id: string;
  de: Status | null;
  para: Status;
  em: string;
  usuario: string;
}

export function AbasProjeto({ historico }: { historico: ItemHistorico[] }) {
  return (
    <Tabs defaultValue="ambientes">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabsList>
          <TabsTrigger value="ambientes">
            <LayoutGrid /> Ambientes
          </TabsTrigger>
          <TabsTrigger value="pecas">
            <Boxes /> Peças
          </TabsTrigger>
          <TabsTrigger value="plano">
            <Scissors /> Plano de corte
          </TabsTrigger>
          <TabsTrigger value="regras">
            <SlidersHorizontal /> Regras
          </TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="ambientes">
        <EstadoVazio
          icone={<FileUp />}
          titulo="Nenhum ambiente ainda"
          descricao="Importe o XML do Promob de cada ambiente (cozinha, dormitório…). A importação chega na próxima etapa."
        />
      </TabsContent>
      <TabsContent value="pecas">
        <EstadoVazio
          icone={<Boxes />}
          titulo="Sem peças"
          descricao="As peças aparecem aqui depois da importação."
        />
      </TabsContent>
      <TabsContent value="plano">
        <EstadoVazio
          icone={<Scissors />}
          titulo="Sem plano de corte"
          descricao="Otimize depois de ter as peças."
        />
      </TabsContent>
      <TabsContent value="regras">
        <EstadoVazio
          icone={<SlidersHorizontal />}
          titulo="Regras do projeto"
          descricao="Ajuste de folgas e fórmulas só deste projeto: chega junto com os módulos."
        />
      </TabsContent>
      <TabsContent value="historico" className="mt-6">
        <ol className="relative max-w-xl space-y-5 border-l pl-6" aria-label="Histórico de status">
          {historico.map((h) => (
            <li key={h.id} className="relative">
              <span className="absolute top-1.5 -left-[1.95rem] size-2.5 rounded-full border-2 border-background bg-primary" />
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {h.de ? (
                  <>
                    <SeloStatus status={h.de} /> <span className="text-muted-foreground">→</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Criado como</span>
                )}
                <SeloStatus status={h.para} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {h.usuario} · {quando(h.em)}
              </p>
            </li>
          ))}
        </ol>
      </TabsContent>
    </Tabs>
  );
}
