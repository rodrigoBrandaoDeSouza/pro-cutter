'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize2,
  Minus,
  Pin,
  PinOff,
  Plus,
  Scissors,
  Wheat,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from 'cn';
import {
  metricas,
  posicionar,
  type ChapaPlano,
  type Material,
  type ParametrosCorte,
  type Peca,
} from '@pro-cutter/core';
import { EstadoVazio } from '@/components/app/cabecalho';
import { MiniFita } from '@/components/app/mini-fita';
import { quando } from '@/components/app/status';
import { ChapaSvg, COR_NIVEL, fmt } from '@/components/plano/chapa-svg';
import { Button } from '@/components/ui/button';
import { BORDAS } from '@/lib/bordas';
import { otimizarPlano } from './actions-plano';

export interface PlanoVM {
  id: string;
  versao: number;
  status: 'ATUAL' | 'DESATUALIZADO';
  criadoEm: string;
  criadoPor: string;
  parametros: ParametrosCorte & { fixadas: { pecaId: string; chapa: number }[] };
  chapas: ChapaPlano[];
  pecas: Peca[];
  materiais: Material[];
}

const pct = (v: number) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const m2 = (mm2: number) =>
  `${(mm2 / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m²`;
const corAproveitamento = (v: number) =>
  v >= 0.8 ? 'text-success' : v >= 0.7 ? 'text-foreground' : 'text-warning';

export function AbaPlano({
  projetoId,
  plano,
  totalPecas,
  nomes,
}: {
  projetoId: string;
  plano: PlanoVM | null;
  totalPecas: number;
  nomes: { ambientes: Record<string, string>; modulos: Record<string, string> };
}) {
  const [otimizando, iniciar] = useTransition();
  const [fixadas, setFixadas] = useState(plano?.parametros.fixadas ?? []);

  const otimizar = (comFixadas = fixadas) =>
    iniciar(async () => {
      const r = await otimizarPlano({ projetoId, fixadas: comFixadas });
      if (r.ok) toast.success(r.mensagem);
      else toast.error(r.erro);
    });

  if (!plano) {
    return (
      <EstadoVazio
        icone={<Scissors />}
        titulo="Nenhum plano de corte ainda"
        descricao={
          totalPecas
            ? `${totalPecas} peças prontas. O otimizador monta as chapas respeitando veio, refilos e a serra da máquina.`
            : 'Importe o XML ou adicione peças antes de otimizar.'
        }
        acao={
          <Button size="lg" disabled={!totalPecas || otimizando} onClick={() => otimizar([])}>
            {otimizando ? <Loader2 className="animate-spin" /> : <Wand2 />} Otimizar corte
          </Button>
        }
      />
    );
  }

  return (
    <VisualizadorPlano
      plano={plano}
      nomes={nomes}
      otimizando={otimizando}
      fixadas={fixadas}
      setFixadas={setFixadas}
      aoOtimizar={() => otimizar()}
    />
  );
}

function VisualizadorPlano({
  plano,
  nomes,
  otimizando,
  fixadas,
  setFixadas,
  aoOtimizar,
}: {
  plano: PlanoVM;
  nomes: { ambientes: Record<string, string>; modulos: Record<string, string> };
  otimizando: boolean;
  fixadas: { pecaId: string; chapa: number }[];
  setFixadas: (f: { pecaId: string; chapa: number }[]) => void;
  aoOtimizar: () => void;
}) {
  const op = useMemo(
    () => ({ serra: plano.parametros.serra, sobraMinima: plano.parametros.sobraMinima }),
    [plano.parametros],
  );
  const pecas = useMemo(() => new Map(plano.pecas.map((p) => [p.id, p])), [plano.pecas]);
  const materiais = useMemo(
    () => new Map(plano.materiais.map((m) => [m.id, m])),
    [plano.materiais],
  );
  const geometrias = useMemo(() => plano.chapas.map((c) => posicionar(c, op)), [plano.chapas, op]);
  const met = useMemo(() => metricas({ chapas: plano.chapas }, op), [plano.chapas, op]);

  // Numeração global das peças (a mesma das etiquetas): chapa a chapa, na ordem do desenho
  const numeros = useMemo(() => {
    let n = 0;
    return geometrias.map((g) => g.pecas.map(() => ++n));
  }, [geometrias]);

  const [sel, setSel] = useState(0);
  const [pecaSel, setPecaSel] = useState<number | undefined>();
  const [painel, setPainel] = useState<'peca' | 'sequencia'>('peca');
  const [passo, setPasso] = useState(0);
  const [zoom, setZoom] = useState(1);

  const chapa = plano.chapas[sel]!;
  const geo = geometrias[sel]!;
  const mat = materiais.get(chapa.materialId);
  const fixadasNaChapa = new Set(
    geo.pecas.flatMap((pp, i) =>
      fixadas.some((f) => f.pecaId === pp.pecaId && f.chapa === chapa.numero) ? [i] : [],
    ),
  );

  const selecionarChapa = (i: number) => {
    setSel(i);
    setPecaSel(undefined);
    setPasso(0);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Versão {plano.versao} · otimizado {quando(plano.criadoEm)} por {plano.criadoPor}
          {fixadas.length > 0 && ` · ${fixadas.length} peça(s) fixada(s)`}
        </p>
        <div className="flex flex-wrap gap-2">
          {fixadas.length > 0 && (
            <Button variant="ghost" onClick={() => setFixadas([])}>
              <PinOff /> Soltar peças fixadas
            </Button>
          )}
          <Button
            variant={plano.status === 'DESATUALIZADO' ? 'default' : 'outline'}
            onClick={aoOtimizar}
            disabled={otimizando}
          >
            {otimizando ? <Loader2 className="animate-spin" /> : <Wand2 />} Otimizar de novo
          </Button>
        </div>
      </div>

      {plano.status === 'DESATUALIZADO' && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>
            <strong className="font-semibold">As peças mudaram depois desta otimização.</strong> O
            plano abaixo não reflete o projeto atual: otimize de novo antes de cortar.
          </span>
        </div>
      )}

      {/* Resumo */}
      <section aria-label="Resumo do plano" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          rotulo="Aproveitamento do projeto"
          valor={pct(met.total.aproveitamento)}
          destaque={corAproveitamento(met.total.aproveitamento)}
          detalhe={`${m2(met.total.areaPecas)} de peças em ${m2(met.total.areaChapa)} de chapa`}
        />
        <Kpi
          rotulo="Chapas"
          valor={String(met.total.chapas)}
          detalhe={`${met.total.pecas} peças`}
        />
        <Kpi
          rotulo="Sobra útil"
          valor={m2(met.total.sobraUtil)}
          detalhe={`maior pedaço: ${m2(met.total.maiorSobraUtil)}`}
        />
        <Kpi
          rotulo="Perda"
          valor={m2(met.total.perda)}
          detalhe="serra, refilos e retalhos pequenos"
        />
      </section>
      <section aria-label="Aproveitamento por material" className="space-y-2">
        {met.porMaterial.map((m) => (
          <div
            key={m.materialId}
            className="grid items-center gap-x-4 gap-y-1 rounded-xl border bg-card px-4 py-3 sm:grid-cols-[1fr_12rem_auto]"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              {materiais.get(m.materialId)?.descricao}
              {materiais.get(m.materialId)?.temVeio && (
                <Wheat className="size-3.5 text-muted-foreground" aria-label="com veio" />
              )}
            </div>
            <Barra valor={m.aproveitamento} />
            <div className="text-sm tabular-nums text-muted-foreground">
              <span className={cn('font-semibold', corAproveitamento(m.aproveitamento))}>
                {pct(m.aproveitamento)}
              </span>{' '}
              · {m.chapas} chapa(s) · {m.pecas} peças
            </div>
          </div>
        ))}
      </section>

      {/* Miniaturas */}
      <section aria-label="Chapas">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
          {plano.chapas.map((c, i) => {
            const mc = met.chapas[i]!;
            return (
              <li key={c.numero}>
                <button
                  type="button"
                  onClick={() => selecionarChapa(i)}
                  aria-pressed={i === sel}
                  aria-label={`Chapa ${c.numero}: ${materiais.get(c.materialId)?.descricao}, ${pct(mc.aproveitamento)}`}
                  className={cn(
                    'w-full rounded-xl border bg-card p-2 text-left transition-all hover:border-primary/50',
                    i === sel && 'border-primary ring-3 ring-primary/20',
                  )}
                >
                  <ChapaSvg
                    mini
                    comprimento={c.comprimento}
                    largura={c.largura}
                    geometria={geometrias[i]!}
                    pecas={pecas}
                    numeros={numeros[i]!}
                    temVeio={materiais.get(c.materialId)?.temVeio}
                  />
                  <div className="mt-2 flex items-center justify-between gap-2 px-1 text-xs">
                    <span className="font-semibold">Chapa {c.numero}</span>
                    <span
                      className={cn(
                        'font-semibold tabular-nums',
                        corAproveitamento(mc.aproveitamento),
                      )}
                    >
                      {mc.aproveitamento < 0.7 && (
                        <AlertTriangle className="mr-0.5 inline size-3" />
                      )}
                      {pct(mc.aproveitamento)}
                    </span>
                  </div>
                  <div className="truncate px-1 text-xs text-muted-foreground">
                    {materiais.get(c.materialId)?.descricao}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Detalhe */}
      <section
        aria-label={`Chapa ${chapa.numero} em detalhe`}
        className="grid gap-4 xl:grid-cols-[1fr_22rem]"
      >
        <div className="min-w-0 rounded-xl border bg-card">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
            <div>
              <h3 className="font-semibold">
                Chapa {chapa.numero} de {plano.chapas.length}
              </h3>
              <p className="text-xs text-muted-foreground">
                {mat?.descricao} · {fmt(chapa.comprimento)} × {fmt(chapa.largura)} mm ·{' '}
                {geo.pecas.length} peças · {pct(met.chapas[sel]!.aproveitamento)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Chapa anterior"
                disabled={sel === 0}
                onClick={() => selecionarChapa(sel - 1)}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Próxima chapa"
                disabled={sel === plano.chapas.length - 1}
                onClick={() => selecionarChapa(sel + 1)}
              >
                <ChevronRight />
              </Button>
              <span className="mx-1 h-5 w-px bg-border" />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Diminuir zoom"
                disabled={zoom <= 1}
                onClick={() => setZoom(Math.max(1, zoom - 0.5))}
              >
                <Minus />
              </Button>
              <span className="w-10 text-center text-xs tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Aumentar zoom"
                disabled={zoom >= 4}
                onClick={() => setZoom(Math.min(4, zoom + 0.5))}
              >
                <Plus />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Ajustar à tela"
                onClick={() => setZoom(1)}
              >
                <Maximize2 />
              </Button>
            </div>
          </header>
          <div className="overflow-auto p-4">
            <div style={{ width: `${zoom * 100}%` }}>
              <ChapaSvg
                comprimento={chapa.comprimento}
                largura={chapa.largura}
                geometria={geo}
                pecas={pecas}
                numeros={numeros[sel]!}
                temVeio={mat?.temVeio}
                selecionada={pecaSel}
                fixadas={fixadasNaChapa}
                aoSelecionar={(i) => {
                  setPecaSel(i);
                  setPainel('peca');
                }}
                corteAtual={painel === 'sequencia' ? passo : undefined}
              />
            </div>
          </div>
          <Legenda />
        </div>

        <aside className="rounded-xl border bg-card">
          <div className="flex border-b p-1" role="tablist" aria-label="Painel da chapa">
            {(
              [
                ['peca', 'Peça'],
                ['sequencia', 'Sequência de cortes'],
              ] as const
            ).map(([v, r]) => (
              <button
                key={v}
                role="tab"
                aria-selected={painel === v}
                onClick={() => setPainel(v)}
                className={cn(
                  'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  painel === v
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="p-4">
            {painel === 'peca' ? (
              <PainelPeca
                indice={pecaSel}
                geo={geo}
                pecas={pecas}
                numeros={numeros[sel]!}
                nomes={nomes}
                temVeio={!!mat?.temVeio}
                fixada={pecaSel !== undefined && fixadasNaChapa.has(pecaSel)}
                aoFixar={(pecaId, fixar) =>
                  setFixadas(
                    fixar
                      ? [
                          ...fixadas.filter((f) => f.pecaId !== pecaId),
                          { pecaId, chapa: chapa.numero },
                        ]
                      : fixadas.filter((f) => f.pecaId !== pecaId),
                  )
                }
              />
            ) : (
              <PainelSequencia geo={geo} passo={passo} setPasso={setPasso} />
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}

function Kpi({
  rotulo,
  valor,
  detalhe,
  destaque,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  destaque?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-sm text-muted-foreground">{rotulo}</div>
      <div className={cn('mt-1 text-3xl font-semibold tracking-tight tabular-nums', destaque)}>
        {valor}
      </div>
      {detalhe && <div className="mt-1 text-xs text-muted-foreground">{detalhe}</div>}
    </div>
  );
}

function Barra({ valor }: { valor: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted" role="presentation">
      <div
        className={cn(
          'h-full rounded-full',
          valor >= 0.8 ? 'bg-success' : valor >= 0.7 ? 'bg-primary' : 'bg-warning',
        )}
        style={{ width: `${Math.min(100, valor * 100)}%` }}
      />
    </div>
  );
}

function Legenda() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 border-t px-4 py-2.5 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 bg-foreground" /> 1º nível
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 bg-sky-600 dark:bg-sky-400" /> 2º nível
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 bg-violet-600 dark:bg-violet-400" /> 3º nível
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-1 w-4 bg-primary" /> fita de borda
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-sm border border-success/60 bg-success/20" /> sobra útil
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-sm bg-foreground/10" /> perda
      </span>
    </div>
  );
}

function PainelPeca({
  indice,
  geo,
  pecas,
  numeros,
  nomes,
  temVeio,
  fixada,
  aoFixar,
}: {
  indice?: number;
  geo: ReturnType<typeof posicionar>;
  pecas: Map<string, Peca>;
  numeros: number[];
  nomes: { ambientes: Record<string, string>; modulos: Record<string, string> };
  temVeio: boolean;
  fixada: boolean;
  aoFixar: (pecaId: string, fixar: boolean) => void;
}) {
  if (indice === undefined) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Toque numa peça da chapa para ver os detalhes.
      </p>
    );
  }
  const pp = geo.pecas[indice]!;
  const p = pecas.get(pp.pecaId);
  if (!p) return null;
  const girada = pp.c !== p.comprimento;
  const origem = [
    p.refs?.ambienteId && nomes.ambientes[p.refs.ambienteId],
    p.refs?.moduloId && nomes.modulos[p.refs.moduloId],
  ]
    .filter(Boolean)
    .join(' › ');

  return (
    <div className="space-y-4" aria-live="polite">
      <div>
        <div className="text-xs font-medium text-muted-foreground">Peça nº {numeros[indice]}</div>
        <div className="text-lg font-semibold">{p.nome}</div>
        {origem && <div className="text-sm text-muted-foreground">{origem}</div>}
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Medida</dt>
          <dd className="font-medium tabular-nums">
            {fmt(p.comprimento)} × {fmt(p.largura)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Na chapa</dt>
          <dd className="font-medium">
            {girada ? 'Girada 90°' : temVeio ? 'No sentido do veio' : 'Sem giro'}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="mb-1 text-xs text-muted-foreground">Fita</dt>
          <dd className="flex items-center gap-2">
            <MiniFita fita={p.fita} />
            <span className="text-xs">
              {BORDAS.filter((_, i) => p.fita[i]! > 0)
                .map((b) => b.toLowerCase())
                .join(', ') || 'sem fita'}
            </span>
          </dd>
        </div>
      </dl>
      <Button
        variant={fixada ? 'secondary' : 'outline'}
        className="w-full"
        onClick={() => aoFixar(p.id, !fixada)}
      >
        {fixada ? <PinOff /> : <Pin />}
        {fixada ? 'Soltar desta chapa' : 'Fixar nesta chapa'}
      </Button>
      <p className="text-xs text-muted-foreground">
        Peças fixadas ficam nesta chapa quando você otimizar de novo.
      </p>
    </div>
  );
}

function PainelSequencia({
  geo,
  passo,
  setPasso,
}: {
  geo: ReturnType<typeof posicionar>;
  passo: number;
  setPasso: (n: number) => void;
}) {
  const total = geo.cortes.length;
  const atual = geo.cortes[passo];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Corte anterior"
          disabled={passo === 0}
          onClick={() => setPasso(passo - 1)}
        >
          <ChevronLeft />
        </Button>
        <div className="text-center">
          <div className="text-xs text-muted-foreground">
            Corte {Math.min(passo + 1, total)} de {total}
          </div>
          {atual && (
            <div className="text-lg font-semibold tabular-nums">
              {atual.refilo ? 'Refilo ' : ''}
              {atual.nivel} · {fmt(atual.medida)} mm
            </div>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Próximo corte"
          disabled={passo >= total - 1}
          onClick={() => setPasso(passo + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
      <ol className="max-h-96 space-y-0.5 overflow-y-auto text-sm" aria-label="Lista de cortes">
        {geo.cortes.map((c, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => setPasso(i)}
              aria-current={i === passo ? 'step' : undefined}
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-2 py-1 text-left tabular-nums transition-colors',
                i === passo
                  ? 'bg-primary/15 font-medium'
                  : i < passo
                    ? 'text-muted-foreground'
                    : 'hover:bg-muted',
              )}
            >
              <span className="w-6 text-right text-xs text-muted-foreground">{i + 1}</span>
              <svg viewBox="0 0 16 4" className="w-4">
                <line
                  x1="0"
                  y1="2"
                  x2="16"
                  y2="2"
                  strokeWidth="3"
                  className={COR_NIVEL[c.nivel]}
                  strokeDasharray={c.refilo ? '4 2' : undefined}
                />
              </svg>
              <span className="w-8">{c.nivel}</span>
              <span>{c.refilo ? `refilo ${fmt(c.medida)}` : `${fmt(c.medida)} mm`}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
