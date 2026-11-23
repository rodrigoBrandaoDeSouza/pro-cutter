'use client';

import { useMemo, useState } from 'react';
import { Boxes, Pencil, Plus, RotateCw, Search, Wheat } from 'lucide-react';
import { cn } from 'cn';
import { EstadoVazio } from '@/components/app/cabecalho';
import { BotaoExcluir } from '@/components/app/confirmar';
import { Campo, SelectNativo, useAcao } from '@/components/app/form';
import { MiniFita } from '@/components/app/mini-fita';
import { mmBR } from '@/components/app/secao';
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
import { BORDAS } from '@/lib/bordas';
import { excluirPeca, salvarPeca } from './actions-pecas';
import type { AmbienteVM, MaterialVM, ModuloVM, OrigemVM, PecaVM } from './tipos';

const ROTULO_ORIGEM: Record<OrigemVM, string> = {
  XML: 'Promob',
  GERADA: 'Gerada',
  MANUAL: 'Avulsa',
};
const COR_ORIGEM: Record<OrigemVM, string> = {
  XML: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  GERADA: 'bg-primary/15 text-primary',
  MANUAL: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
};

export function AbaPecas({
  projetoId,
  ambientes,
  modulos,
  pecas,
  materiais,
}: {
  projetoId: string;
  ambientes: AmbienteVM[];
  modulos: ModuloVM[];
  pecas: PecaVM[];
  materiais: MaterialVM[];
}) {
  const [ambiente, setAmbiente] = useState('');
  const [origem, setOrigem] = useState('');
  const [busca, setBusca] = useState('');
  const materialPorId = useMemo(() => new Map(materiais.map((m) => [m.id, m])), [materiais]);
  const nomeAmbiente = new Map(ambientes.map((a) => [a.id, a.nome]));
  const nomeModulo = new Map(modulos.map((m) => [m.id, m.nome]));

  const filtradas = pecas.filter(
    (p) =>
      (!ambiente || p.ambienteId === ambiente) &&
      (!origem || p.origem === origem) &&
      (!busca || p.nome.toLowerCase().includes(busca.toLowerCase())),
  );
  const grupos = useMemo(() => {
    const g = new Map<string, PecaVM[]>();
    for (const p of filtradas) g.set(p.materialId, [...(g.get(p.materialId) ?? []), p]);
    return [...g].sort(
      (a, b) =>
        (materialPorId.get(b[0])?.espessura ?? 0) - (materialPorId.get(a[0])?.espessura ?? 0),
    );
  }, [filtradas, materialPorId]);

  if (ambientes.length === 0) {
    return (
      <EstadoVazio
        icone={<Boxes />}
        titulo="Sem peças ainda"
        descricao="Importe o XML do Promob na aba Ambientes ou crie um ambiente para adicionar peças avulsas."
      />
    );
  }

  return (
    <div className="space-y-6">
      <ResumoMateriais pecas={pecas} materiais={materialPorId} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Buscar peças"
              placeholder="Buscar peça"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-8"
            />
          </div>
          <SelectNativo
            aria-label="Filtrar por ambiente"
            value={ambiente}
            onChange={(e) => setAmbiente(e.target.value)}
            className="w-auto"
          >
            <option value="">Todos os ambientes</option>
            {ambientes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </SelectNativo>
          <SelectNativo
            aria-label="Filtrar por origem"
            value={origem}
            onChange={(e) => setOrigem(e.target.value)}
            className="w-auto"
          >
            <option value="">Todas as origens</option>
            {(Object.keys(ROTULO_ORIGEM) as OrigemVM[]).map((o) => (
              <option key={o} value={o}>
                {ROTULO_ORIGEM[o]}
              </option>
            ))}
          </SelectNativo>
        </div>
        <DialogoPeca
          projetoId={projetoId}
          ambientes={ambientes}
          materiais={materiais}
          ambienteInicial={ambiente}
        />
      </div>

      {grupos.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nenhuma peça com esses filtros.
        </p>
      ) : (
        grupos.map(([materialId, lista]) => {
          const m = materialPorId.get(materialId);
          const qtd = lista.reduce((s, p) => s + p.quantidade, 0);
          return (
            <section
              key={materialId}
              className="overflow-hidden rounded-xl border bg-card"
              aria-label={`Peças em ${m?.descricao}`}
            >
              <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  {m?.descricao ?? 'Material removido'}
                  {m?.temVeio && (
                    <Wheat className="size-3.5 text-muted-foreground" aria-label="com veio" />
                  )}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {qtd} peça(s) · {lista.length} linha(s)
                </span>
              </header>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Peça</TableHead>
                      <TableHead className="text-right">Comprimento × largura</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead>Fita</TableHead>
                      <TableHead className="w-24 pr-4">
                        <span className="sr-only">Ações</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lista.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="pl-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{p.nome}</span>
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[11px] font-medium',
                                COR_ORIGEM[p.origem],
                              )}
                            >
                              {ROTULO_ORIGEM[p.origem]}
                            </span>
                            {p.podeGirar && !m?.temVeio && (
                              <RotateCw
                                className="size-3.5 text-muted-foreground"
                                aria-label="pode girar"
                              />
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {nomeAmbiente.get(p.ambienteId)}
                            {p.moduloId && ` › ${nomeModulo.get(p.moduloId) ?? 'módulo'}`}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {mmBR(p.comprimento)} × {mmBR(p.largura)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{p.quantidade}</TableCell>
                        <TableCell>
                          <MiniFita fita={p.fita} />
                        </TableCell>
                        <TableCell className="pr-4">
                          {p.origem !== 'GERADA' && (
                            <div className="flex justify-end gap-1">
                              <DialogoPeca
                                projetoId={projetoId}
                                ambientes={ambientes}
                                materiais={materiais}
                                peca={p}
                              />
                              <BotaoExcluir
                                rotulo={`Remover ${p.nome}`}
                                titulo={`Remover ${p.nome}?`}
                                descricao={
                                  p.origem === 'XML'
                                    ? 'A peça volta se o XML do ambiente for reimportado.'
                                    : 'Esta ação não pode ser desfeita.'
                                }
                                acao={() => excluirPeca(p.id)}
                              />
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function ResumoMateriais({
  pecas,
  materiais,
}: {
  pecas: PecaVM[];
  materiais: Map<string, MaterialVM>;
}) {
  const porMaterial = new Map<string, { qtd: number; area: number }>();
  for (const p of pecas) {
    const r = porMaterial.get(p.materialId) ?? { qtd: 0, area: 0 };
    r.qtd += p.quantidade;
    r.area += (p.comprimento * p.largura * p.quantidade) / 1e6;
    porMaterial.set(p.materialId, r);
  }
  if (porMaterial.size === 0) return null;
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo por material">
      {[...porMaterial].map(([id, r]) => {
        const m = materiais.get(id);
        const chapa = m ? (m.chapaComprimento * m.chapaLargura) / 1e6 : 0;
        return (
          <li key={id} className="rounded-xl border bg-card p-4">
            <div className="truncate text-sm font-medium">{m?.descricao}</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums">{r.qtd}</span>
              <span className="text-sm text-muted-foreground">peças</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {r.area.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m²
              {chapa > 0 &&
                ` · ≈ ${(r.area / chapa).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} chapa(s) sem perda`}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function DialogoPeca({
  projetoId,
  ambientes,
  materiais,
  peca,
  ambienteInicial,
}: {
  projetoId: string;
  ambientes: AmbienteVM[];
  materiais: MaterialVM[];
  peca?: PecaVM;
  ambienteInicial?: string;
}) {
  const ativos = materiais.filter((m) => m.ativo || m.id === peca?.materialId);
  const vazio = () => ({
    nome: peca?.nome ?? '',
    tipo: peca?.tipo ?? 'outro',
    ambienteId: peca?.ambienteId ?? (ambienteInicial || ambientes[0]?.id || ''),
    comprimento: peca ? mmBR(peca.comprimento) : '',
    largura: peca ? mmBR(peca.largura) : '',
    quantidade: String(peca?.quantidade ?? 1),
    materialId: peca?.materialId ?? ativos[0]?.id ?? '',
    fita: (peca?.fita ?? [0, 0, 0, 0]).map((v) => mmBR(v)) as string[],
    podeGirar: peca?.podeGirar ?? true,
    materialAlternativo: peca?.materialAlternativo ?? false,
  });
  const [aberto, setAberto] = useState(false);
  const [f, setF] = useState(vazio);
  const { executar, pendente, erros, limparErros } = useAcao(salvarPeca, {
    aoConcluir: () => setAberto(false),
  });
  const material = materiais.find((m) => m.id === f.materialId);
  const d = (s: string) => s.replace(',', '.');

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        if (v) {
          limparErros();
          setF(vazio());
        }
      }}
    >
      <DialogTrigger
        render={
          peca ? (
            <Button variant="ghost" size="icon" aria-label={`Editar ${peca.nome}`} />
          ) : (
            <Button />
          )
        }
      >
        {peca ? (
          <Pencil />
        ) : (
          <>
            <Plus /> Peça avulsa
          </>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            executar({
              projetoId,
              ...(peca ? { id: peca.id } : {}),
              ambienteId: f.ambienteId,
              nome: f.nome,
              tipo: f.tipo,
              comprimento: d(f.comprimento),
              largura: d(f.largura),
              quantidade: f.quantidade,
              materialId: f.materialId,
              fita: f.fita.map(d) as [string, string, string, string],
              podeGirar: f.podeGirar,
              materialAlternativo: f.materialAlternativo,
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{peca ? `Editar ${peca.nome}` : 'Peça avulsa'}</DialogTitle>
            <DialogDescription>
              {peca?.origem === 'XML'
                ? 'Peça do Promob: a alteração é perdida se o XML for reimportado.'
                : 'Uma peça que não veio do Promob nem de um módulo.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="pc-nome" rotulo="Nome" erro={erros.nome}>
              <Input
                id="pc-nome"
                value={f.nome}
                onChange={(e) => setF({ ...f, nome: e.target.value })}
                autoFocus
              />
            </Campo>
            <Campo id="pc-amb" rotulo="Ambiente" erro={erros.ambienteId}>
              <SelectNativo
                id="pc-amb"
                value={f.ambienteId}
                onChange={(e) => setF({ ...f, ambienteId: e.target.value })}
              >
                {ambientes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
              </SelectNativo>
            </Campo>
          </div>
          <Campo id="pc-mat" rotulo="Material" erro={erros.materialId}>
            <SelectNativo
              id="pc-mat"
              value={f.materialId}
              onChange={(e) => setF({ ...f, materialId: e.target.value })}
            >
              {ativos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.descricao}
                </option>
              ))}
            </SelectNativo>
          </Campo>
          <div className="grid grid-cols-3 gap-3">
            <Campo id="pc-comp" rotulo="Comprimento" erro={erros.comprimento}>
              <Input
                id="pc-comp"
                inputMode="decimal"
                value={f.comprimento}
                onChange={(e) => setF({ ...f, comprimento: e.target.value })}
                aria-invalid={!!erros.comprimento}
              />
            </Campo>
            <Campo id="pc-larg" rotulo="Largura" erro={erros.largura}>
              <Input
                id="pc-larg"
                inputMode="decimal"
                value={f.largura}
                onChange={(e) => setF({ ...f, largura: e.target.value })}
                aria-invalid={!!erros.largura}
              />
            </Campo>
            <Campo id="pc-qtd" rotulo="Quantidade" erro={erros.quantidade}>
              <Input
                id="pc-qtd"
                inputMode="numeric"
                value={f.quantidade}
                onChange={(e) => setF({ ...f, quantidade: e.target.value })}
              />
            </Campo>
          </div>
          {material?.temVeio && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Wheat className="size-3.5" /> Material com veio: o comprimento acompanha o veio e a
              peça não gira.
            </p>
          )}
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Fita de borda (mm)</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {BORDAS.map((b, i) => (
                <label
                  key={b}
                  className="space-y-1 text-xs whitespace-nowrap text-muted-foreground"
                >
                  {b.replace('Comprimento', 'Comp.').replace('Largura', 'Larg.')}
                  <Input
                    inputMode="decimal"
                    aria-label={`Fita ${b}`}
                    value={f.fita[i]}
                    onChange={(e) =>
                      setF({ ...f, fita: f.fita.map((v, k) => (k === i ? e.target.value : v)) })
                    }
                    className="text-right"
                  />
                </label>
              ))}
            </div>
          </fieldset>
          <div className="space-y-2">
            {!material?.temVeio && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={f.podeGirar}
                  onChange={(e) => setF({ ...f, podeGirar: e.target.checked })}
                />
                Pode girar na chapa
              </label>
            )}
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-primary"
                checked={f.materialAlternativo}
                onChange={(e) => setF({ ...f, materialAlternativo: e.target.checked })}
              />
              <span>
                Pode ser cortada em sobra de outro material
                <span className="block text-xs text-muted-foreground">
                  Útil para peças escondidas (sarrafos). Só usa material de mesma espessura.
                </span>
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pendente}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
