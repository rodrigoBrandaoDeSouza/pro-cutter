'use client';

import { useMemo, useState } from 'react';
import { MoreHorizontal, Pencil, Plus, SlidersHorizontal } from 'lucide-react';
import type { Material } from '@pro-cutter/core';
import {
  gerarPecas,
  resolverRegras,
  type TipoModulo,
  type ValoresRegras,
} from '@pro-cutter/regras';
import { BotaoExcluir } from '@/components/app/confirmar';
import { Campo, SelectNativo, useAcao } from '@/components/app/form';
import { mmBR } from '@/components/app/secao';
import { quando } from '@/components/app/status';
import { Badge } from '@/components/ui/badge';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { criarAmbiente, excluirAmbiente, renomearAmbiente } from './actions-importacao';
import { excluirModulo, salvarModulo } from './actions-pecas';
import { ImportarXml } from './importar-xml';
import type { AmbienteVM, MaterialVM, ModuloVM, ParametroVM, PecaVM } from './tipos';

interface Props {
  projetoId: string;
  ambientes: AmbienteVM[];
  modulos: ModuloVM[];
  pecas: PecaVM[];
  materiais: MaterialVM[];
  tipos: TipoModulo[];
  parametros: ParametroVM[];
  regras: ValoresRegras;
}

export function AbaAmbientes(props: Props) {
  const { projetoId, ambientes, materiais } = props;
  if (ambientes.length === 0) {
    return (
      <div className="space-y-4">
        <ImportarXml projetoId={projetoId} materiais={materiais} grande />
        <p className="text-center text-sm text-muted-foreground">
          Sem XML? <DialogoAmbiente projetoId={projetoId} comoLink /> e adicione módulos e peças à
          mão.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <ImportarXml projetoId={projetoId} materiais={materiais} />
        <DialogoAmbiente projetoId={projetoId} />
      </div>
      {ambientes.map((a) => (
        <CartaoAmbiente key={a.id} ambiente={a} {...props} />
      ))}
    </div>
  );
}

function CartaoAmbiente({ ambiente, ...p }: Props & { ambiente: AmbienteVM }) {
  const modulos = p.modulos.filter((m) => m.ambienteId === ambiente.id);
  const pecas = p.pecas.filter((x) => x.ambienteId === ambiente.id);
  const soma = (o: PecaVM['origem']) =>
    pecas.filter((x) => x.origem === o).reduce((s, x) => s + x.quantidade, 0);
  const [renomeando, setRenomeando] = useState(false);

  return (
    <section className="rounded-xl border bg-card" aria-label={`Ambiente ${ambiente.nome}`}>
      <header className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">{ambiente.nome}</h2>
          <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-muted-foreground">
            <span>
              {ambiente.importadoEm ? `XML importado ${quando(ambiente.importadoEm)}` : 'Sem XML'}
            </span>
            <span>
              {soma('XML')} do Promob · {soma('GERADA')} geradas · {soma('MANUAL')} avulsas
            </span>
          </p>
        </div>
        <div className="flex items-center gap-1">
          <ImportarXml
            projetoId={p.projetoId}
            materiais={p.materiais}
            reimportar={{ id: ambiente.id, nome: ambiente.nome }}
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon" aria-label={`Mais ações de ${ambiente.nome}`} />
              }
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setRenomeando(true)}>
                <Pencil /> Renomear
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <BotaoExcluir
            rotulo={`Excluir ambiente ${ambiente.nome}`}
            titulo={`Excluir ${ambiente.nome}?`}
            descricao="Módulos e peças deste ambiente serão apagados."
            acao={() => excluirAmbiente(ambiente.id)}
          />
        </div>
      </header>
      <DialogoAmbiente
        projetoId={p.projetoId}
        ambiente={ambiente}
        aberto={renomeando}
        aoMudarAberto={setRenomeando}
      />

      <div className="p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Módulos</h3>
            <p className="text-xs text-muted-foreground">
              Geram portas e fundos pelas fórmulas do projeto.
            </p>
          </div>
          <DialogoModulo {...p} ambienteId={ambiente.id} />
        </div>
        {modulos.length === 0 ? (
          <p className="rounded-lg bg-muted/50 px-3 py-4 text-center text-sm text-muted-foreground">
            Nenhum módulo. Adicione os módulos que precisam de porta ou fundo.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {modulos.map((m) => {
              const geradas = p.pecas.filter((x) => x.moduloId === m.id);
              const tipo = p.tipos.find((t) => t.id === m.tipoId);
              const temRegra = Object.keys(m.regras).length > 0;
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5">
                  <div className="min-w-40 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {m.nome}
                      {temRegra && (
                        <Badge variant="outline" title="Regras próprias neste módulo">
                          <SlidersHorizontal /> Regras próprias
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {tipo?.nome ?? m.tipoId} · {mmBR(m.L)} × {mmBR(m.A)} × {mmBR(m.P)} ·{' '}
                      {m.nPortas} porta(s)
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {geradas.map((g) => (
                      <Badge key={g.id} variant="secondary" className="tabular-nums">
                        {g.quantidade}× {g.nome} {mmBR(g.comprimento)}×{mmBR(g.largura)}
                      </Badge>
                    ))}
                  </div>
                  <div className="ml-auto flex gap-1">
                    <DialogoModulo {...p} ambienteId={ambiente.id} modulo={m} />
                    <BotaoExcluir
                      rotulo={`Excluir módulo ${m.nome}`}
                      titulo={`Excluir o módulo ${m.nome}?`}
                      descricao="As portas e fundos gerados por ele também saem do projeto."
                      acao={() => excluirModulo(m.id)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function DialogoAmbiente({
  projetoId,
  ambiente,
  comoLink,
  aberto: abertoExterno,
  aoMudarAberto,
}: {
  projetoId: string;
  ambiente?: AmbienteVM;
  comoLink?: boolean;
  aberto?: boolean;
  aoMudarAberto?: (v: boolean) => void;
}) {
  const [abertoInterno, setAbertoInterno] = useState(false);
  const aberto = abertoExterno ?? abertoInterno;
  const setAberto = aoMudarAberto ?? setAbertoInterno;
  const [nome, setNome] = useState(ambiente?.nome ?? '');
  const criar = useAcao(criarAmbiente, { aoConcluir: () => setAberto(false) });
  const renomear = useAcao(renomearAmbiente, { aoConcluir: () => setAberto(false) });
  const { pendente, erros } = ambiente ? renomear : criar;

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        if (v) setNome(ambiente?.nome ?? '');
      }}
    >
      {!ambiente && (
        <DialogTrigger
          render={
            comoLink ? (
              <button type="button" className="font-medium text-primary hover:underline" />
            ) : (
              <Button variant="ghost" />
            )
          }
        >
          {comoLink ? (
            'Crie um ambiente vazio'
          ) : (
            <>
              <Plus /> Ambiente vazio
            </>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-sm">
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (ambiente) renomear.executar({ id: ambiente.id, nome });
            else criar.executar({ projetoId, nome });
          }}
        >
          <DialogHeader>
            <DialogTitle>{ambiente ? 'Renomear ambiente' : 'Novo ambiente'}</DialogTitle>
          </DialogHeader>
          <Campo id="amb-nome" rotulo="Nome do ambiente" erro={erros.nome}>
            <Input
              id="amb-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Banheiro"
              autoFocus
            />
          </Campo>
          <DialogFooter>
            <Button type="submit" disabled={pendente}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function materialMaisUsado(pecas: PecaVM[], ambienteId: string): string | undefined {
  const cont = new Map<string, number>();
  for (const p of pecas) {
    if (p.ambienteId === ambienteId && p.origem === 'XML')
      cont.set(p.materialId, (cont.get(p.materialId) ?? 0) + p.quantidade);
  }
  return [...cont].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function DialogoModulo({
  ambienteId,
  modulo,
  ...p
}: Props & { ambienteId: string; modulo?: ModuloVM }) {
  const ativos = p.materiais.filter((m) => m.ativo || m.id === modulo?.materialCaixaId);
  const padroes = () => {
    const caixa = materialMaisUsado(p.pecas, ambienteId) ?? ativos[0]?.id ?? '';
    const fundo = ativos.find((m) => m.espessura <= 6)?.id ?? caixa;
    return {
      nome: modulo?.nome ?? '',
      tipoId: modulo?.tipoId ?? p.tipos[0]?.id ?? '',
      L: modulo ? mmBR(modulo.L) : '',
      A: modulo ? mmBR(modulo.A) : '',
      P: modulo ? mmBR(modulo.P) : '',
      nPortas: String(modulo?.nPortas ?? 2),
      materialCaixaId: modulo?.materialCaixaId ?? caixa,
      materialPortaId: modulo ? (modulo.materialPortaId ?? '') : caixa,
      materialFundoId: modulo ? (modulo.materialFundoId ?? '') : fundo,
      regras: Object.fromEntries(
        Object.entries(modulo?.regras ?? {}).map(([k, v]) => [k, mmBR(v)]),
      ) as Record<string, string>,
      extras: Object.fromEntries(
        Object.entries(modulo?.extras ?? {}).map(([k, v]) => [k, String(v)]),
      ) as Record<string, string>,
    };
  };
  const [aberto, setAberto] = useState(false);
  const [mostrarRegras, setMostrarRegras] = useState(false);
  const [f, setF] = useState(padroes);
  const { executar, pendente, erros, limparErros } = useAcao(salvarModulo, {
    aoConcluir: () => setAberto(false),
  });
  const tipo = p.tipos.find((t) => t.id === f.tipoId);
  const n = (s: string) => Number(s.replace(',', '.'));
  const numeros = (r: Record<string, string>) =>
    Object.fromEntries(
      Object.entries(r)
        .filter(([, v]) => v.trim() !== '')
        .map(([k, v]) => [k, n(v)]),
    );

  const previa = useMemo(() => {
    if (!tipo) return null;
    const mats: Material[] = p.materiais.map((m) => ({
      id: m.id,
      descricao: m.descricao,
      espessura: m.espessura,
      chapa: { comprimento: m.chapaComprimento, largura: m.chapaLargura },
      temVeio: m.temVeio,
    }));
    try {
      return gerarPecas(
        {
          id: 'previa',
          nome: f.nome || 'Módulo',
          tipoId: f.tipoId,
          L: n(f.L) || 0,
          A: n(f.A) || 0,
          P: n(f.P) || 0,
          nPortas: Math.round(n(f.nPortas) || 0),
          materiais: {
            caixa: f.materialCaixaId,
            ...(f.materialPortaId ? { porta: f.materialPortaId } : {}),
            ...(f.materialFundoId ? { fundo: f.materialFundoId } : {}),
          },
          extras: numeros(f.extras),
        },
        tipo,
        resolverRegras(p.regras, {}, numeros(f.regras)),
        mats,
      );
    } catch {
      return null;
    }
  }, [f, tipo, p.regras, p.materiais]);

  const descricaoMaterial = (id: string) => p.materiais.find((m) => m.id === id)?.descricao ?? '';
  const seletorMaterial = (
    campo: 'materialCaixaId' | 'materialPortaId' | 'materialFundoId',
    rotulo: string,
    opcional: boolean,
  ) => (
    <Campo id={`mod-${campo}`} rotulo={rotulo} erro={erros[campo]}>
      <SelectNativo
        id={`mod-${campo}`}
        value={f[campo]}
        onChange={(e) => setF({ ...f, [campo]: e.target.value })}
      >
        {opcional && <option value="">Nenhum</option>}
        {ativos.map((m) => (
          <option key={m.id} value={m.id}>
            {m.descricao}
          </option>
        ))}
      </SelectNativo>
    </Campo>
  );

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        if (v) {
          limparErros();
          setF(padroes());
          setMostrarRegras(!!modulo && Object.keys(modulo.regras).length > 0);
        }
      }}
    >
      <DialogTrigger
        render={
          modulo ? (
            <Button variant="ghost" size="icon" aria-label={`Editar módulo ${modulo.nome}`} />
          ) : (
            <Button variant="outline" size="sm" />
          )
        }
      >
        {modulo ? (
          <Pencil />
        ) : (
          <>
            <Plus /> Novo módulo
          </>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            executar({
              projetoId: p.projetoId,
              ambienteId,
              ...(modulo ? { id: modulo.id } : {}),
              nome: f.nome,
              tipoId: f.tipoId,
              L: f.L.replace(',', '.'),
              A: f.A.replace(',', '.'),
              P: f.P.replace(',', '.'),
              nPortas: f.nPortas,
              materialCaixaId: f.materialCaixaId,
              materialPortaId: f.materialPortaId,
              materialFundoId: f.materialFundoId,
              regras: numeros(f.regras),
              extras: numeros(f.extras),
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{modulo ? `Editar ${modulo.nome}` : 'Novo módulo'}</DialogTitle>
            <DialogDescription>Medidas externas do módulo, em milímetros.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="mod-nome" rotulo="Nome" erro={erros.nome}>
              <Input
                id="mod-nome"
                placeholder="Ex.: Balcão da pia"
                value={f.nome}
                onChange={(e) => setF({ ...f, nome: e.target.value })}
                autoFocus
              />
            </Campo>
            <Campo id="mod-tipo" rotulo="Tipo" erro={erros.tipoId}>
              <SelectNativo
                id="mod-tipo"
                value={f.tipoId}
                onChange={(e) => setF({ ...f, tipoId: e.target.value })}
              >
                {p.tipos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </SelectNativo>
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ['L', 'Largura'],
                ['A', 'Altura'],
                ['P', 'Profundidade'],
                ['nPortas', 'Portas'],
              ] as const
            ).map(([k, rotulo]) => (
              <Campo key={k} id={`mod-${k}`} rotulo={rotulo} erro={erros[k]}>
                <Input
                  id={`mod-${k}`}
                  inputMode={k === 'nPortas' ? 'numeric' : 'decimal'}
                  value={f[k]}
                  onChange={(e) => setF({ ...f, [k]: e.target.value })}
                  aria-invalid={!!erros[k]}
                  className="text-right tabular-nums"
                />
              </Campo>
            ))}
          </div>
          {(tipo?.extras ?? []).length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {tipo!.extras!.map((x) => (
                <Campo key={x.chave} id={`mod-x-${x.chave}`} rotulo={x.rotulo || x.chave}>
                  <Input
                    id={`mod-x-${x.chave}`}
                    inputMode="decimal"
                    placeholder={String(x.padrao)}
                    value={f.extras[x.chave] ?? ''}
                    onChange={(e) =>
                      setF({ ...f, extras: { ...f.extras, [x.chave]: e.target.value } })
                    }
                  />
                </Campo>
              ))}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            {seletorMaterial('materialCaixaId', 'Material da caixa', false)}
            {seletorMaterial('materialPortaId', 'Material da porta', true)}
            {seletorMaterial('materialFundoId', 'Material do fundo', true)}
          </div>

          <div className="rounded-xl border">
            <button
              type="button"
              onClick={() => setMostrarRegras(!mostrarRegras)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
              aria-expanded={mostrarRegras}
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="size-4 text-muted-foreground" /> Regras só deste
                módulo
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {Object.values(f.regras).filter((v) => v.trim()).length || 'nenhuma'} alterada(s)
              </span>
            </button>
            {mostrarRegras && (
              <div className="grid gap-3 border-t px-4 py-3 sm:grid-cols-2">
                {p.parametros.map((par) => (
                  <label key={par.chave} className="space-y-1 text-xs text-muted-foreground">
                    {par.rotulo}
                    <Input
                      inputMode="decimal"
                      aria-label={`Regra do módulo: ${par.rotulo}`}
                      placeholder={`${mmBR(p.regras[par.chave] ?? 0)} (projeto)`}
                      value={f.regras[par.chave] ?? ''}
                      onChange={(e) =>
                        setF({ ...f, regras: { ...f.regras, [par.chave]: e.target.value } })
                      }
                      className="text-right"
                    />
                  </label>
                ))}
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  Em branco, vale o valor do projeto.
                </p>
              </div>
            )}
          </div>

          <div
            aria-label="Prévia das peças do módulo"
            role="region"
            className="rounded-xl bg-muted/50 p-4"
          >
            <h3 className="mb-2 text-sm font-semibold">Peças que serão geradas</h3>
            {!previa || (previa.pecas.length === 0 && previa.erros.length === 0) ? (
              <p className="text-sm text-muted-foreground">Informe as medidas para ver as peças.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {previa.pecas.map((x) => (
                  <li key={x.id} className="flex justify-between gap-3">
                    <span>
                      {x.quantidade}× {x.nome}{' '}
                      <span className="text-xs text-muted-foreground">
                        ({descricaoMaterial(x.materialId)})
                      </span>
                    </span>
                    <span className="tabular-nums">
                      {mmBR(x.comprimento)} × {mmBR(x.largura)}
                    </span>
                  </li>
                ))}
                {previa.erros.map((e, i) => (
                  <li key={i} className="text-xs text-destructive">
                    {e.peca}: {e.mensagem}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pendente}>
              {modulo ? 'Salvar módulo' : 'Criar módulo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
