import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowDownRight,
  ArrowUpRight,
  CircleAlert,
  LayoutDashboard,
  type LucideIcon,
} from 'lucide-react';
import { cn } from 'cn';
import { Cabecalho, EstadoVazio } from '@/components/app/cabecalho';
import { SeloStatus } from '@/components/app/status';
import { BarrasMensais } from '@/components/painel/barras-mensais';
import { buttonVariants } from '@/components/ui/button';
import { formatar } from '@/lib/formatos';
import { montarPainel, type LinhaProjeto } from '@/lib/server/painel';
import { dbDoUsuario } from '@/lib/server/sessao';
import { Referencia } from './referencia';

export const metadata: Metadata = { title: 'Painel' };

const PERIODOS = [3, 6, 12] as const;

export default async function PaginaPainel({ searchParams }: PageProps<'/painel'>) {
  const { usuario, db } = await dbDoUsuario();
  const sp = await searchParams;
  const meses = PERIODOS.find((p) => String(p) === sp.meses) ?? 12;
  const d = await montarPainel(db, meses);
  const p = d.periodo;
  const ehAdmin = usuario.papel === 'ADMIN';
  const comPreco = p.custo > 0;

  const filtro = (
    <nav aria-label="Período" className="inline-flex rounded-lg border bg-muted p-0.5 text-sm">
      {PERIODOS.map((n) => (
        <Link
          key={n}
          href={`/painel?meses=${n}`}
          aria-current={n === meses ? 'page' : undefined}
          className={cn(
            'rounded-md px-3 py-1.5 transition-colors',
            n === meses
              ? 'bg-background font-medium shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {n} meses
        </Link>
      ))}
    </nav>
  );

  if (p.projetos === 0 && d.anterior.projetos === 0) {
    return (
      <>
        <Cabecalho titulo="Painel" descricao="Aproveitamento das chapas cortadas." acao={filtro} />
        <EstadoVazio
          icone={<LayoutDashboard />}
          titulo="Ainda não há cortes no período"
          descricao="O painel conta os projetos que chegaram a “Em corte”, “Cortado” ou “Entregue”. Otimize um plano e avance o status do projeto."
          acao={
            <Link href="/projetos" className={buttonVariants()}>
              Ir para projetos
            </Link>
          }
        />
      </>
    );
  }

  const pontos = d.mensal.map((m) => ({ mes: m.mes, vazio: m.projetos === 0 }));
  const variacao = (atual: number, antes: number) => (d.anterior.projetos ? atual - antes : null);

  return (
    <>
      <Cabecalho
        titulo="Painel"
        descricao={`Chapas cortadas nos últimos ${meses} meses (projetos em corte, cortados e entregues).`}
        acao={filtro}
      />
      <div className="space-y-6 px-4 py-6 sm:px-8">
        {d.materiaisSemPreco > 0 && ehAdmin && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
            <CircleAlert className="size-4 shrink-0 text-warning" />
            <span className="flex-1">
              {d.materiaisSemPreco === 1
                ? '1 material está sem preço'
                : `${d.materiaisSemPreco} materiais estão sem preço`}
              . Custo, desperdício e economia em reais contam só os materiais com preço.
            </span>
            <Link
              href="/configuracoes?aba=materiais"
              className={buttonVariants({ size: 'sm', variant: 'outline' })}
            >
              Cadastrar preços
            </Link>
          </div>
        )}

        {/* Indicadores principais */}
        <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Indicador
            rotulo="Aproveitamento"
            valor={formatar(p.aproveitamento, 'pct')}
            detalhe={`Sem as sobras úteis · bruto ${formatar(p.aproveitamentoBruto, 'pct')} · referência ${formatar(d.referencia, 'pct')}`}
            delta={variacao(p.aproveitamento, d.anterior.aproveitamento)}
            formatoDelta={(v) => `${v > 0 ? '+' : ''}${formatar(v * 100, 'inteiro')} p.p.`}
            bomSeSobe
          />
          <Indicador
            rotulo="Chapas cortadas"
            valor={formatar(p.chapas, 'inteiro')}
            detalhe={`${p.projetos} projeto(s) · ${formatar(p.areaChapa, 'm2')}`}
          />
          <Indicador
            rotulo="Desperdício"
            valor={comPreco ? formatar(p.custoDesperdicio, 'reais') : formatar(p.desperdicio, 'm2')}
            detalhe={`${formatar(p.desperdicio, 'm2')} · ${formatar(
              p.areaChapa ? p.desperdicio / p.areaChapa : 0,
              'pct',
            )} da área`}
            delta={variacao(
              p.areaChapa ? p.desperdicio / p.areaChapa : 0,
              d.anterior.areaChapa ? d.anterior.desperdicio / d.anterior.areaChapa : 0,
            )}
            formatoDelta={(v) => `${v > 0 ? '+' : ''}${formatar(v * 100, 'inteiro')} p.p.`}
          />
          <Indicador
            rotulo="Economia estimada"
            valor={
              comPreco ? formatar(p.economiaReais, 'reais') : formatar(p.economiaChapas, 'chapas')
            }
            detalhe={`${formatar(p.economiaChapas, 'chapas')} a menos que com ${formatar(d.referencia, 'pct')} de aproveitamento`}
            destaque={p.economiaChapas >= 0 ? 'bom' : 'ruim'}
          />
        </section>

        <section
          aria-label="Outros números"
          className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4"
        >
          <Mini rotulo="Custo em chapas" valor={comPreco ? formatar(p.custo, 'reais') : '–'} />
          <Mini
            rotulo="Sobras úteis"
            valor={formatar(p.sobraUtil, 'm2')}
            dica="Retalhos grandes o bastante para reaproveitar"
          />
          <Mini rotulo="Peças cortadas" valor={formatar(p.pecas, 'inteiro')} />
          <Mini rotulo="Fita de borda" valor={`${formatar(p.fitaMetros, 'inteiro')} m`} />
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Cartao
            titulo="Aproveitamento por mês"
            descricao="Área das peças ÷ área de chapa consumida (as sobras úteis voltam ao estoque). A linha tracejada é a referência."
          >
            <BarrasMensais
              titulo="Aproveitamento por mês"
              formato="pct"
              series={[{ chave: 'v', rotulo: 'Aproveitamento', cor: 'var(--viz-1)' }]}
              referencia={{
                valor: d.referencia,
                rotulo: `referência ${formatar(d.referencia, 'pct')}`,
              }}
              pontos={d.mensal.map((m, i) => ({
                ...pontos[i]!,
                valores: { v: m.aproveitamento },
                detalhes: [`${m.chapas} chapas · ${m.projetos} projeto(s)`],
              }))}
            />
          </Cartao>

          <Cartao titulo="Na fila" descricao="Projetos abertos e chapas previstas nos planos.">
            <ul className="space-y-3">
              {d.funil.map((f) => (
                <li key={f.status} className="flex items-center gap-3">
                  <SeloStatus status={f.status} className="w-24 justify-center" />
                  <span className="flex-1 text-sm">
                    <strong className="text-base tabular-nums">{f.projetos}</strong> projeto(s)
                  </span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {f.chapas} chapas
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href="/projetos"
              className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
            >
              Ver projetos
            </Link>
          </Cartao>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Cartao
            titulo="Para onde vai a chapa"
            descricao="Área por mês: o que virou peça, o que sobrou como retalho útil e o que foi perdido."
          >
            <BarrasMensais
              titulo="Para onde vai a chapa"
              formato="m2"
              series={[
                { chave: 'pecas', rotulo: 'Peças', cor: 'var(--viz-1)' },
                { chave: 'sobra', rotulo: 'Sobra útil', cor: 'var(--viz-2)' },
                { chave: 'perda', rotulo: 'Desperdício', cor: 'var(--viz-3)' },
              ]}
              pontos={d.mensal.map((m, i) => ({
                ...pontos[i]!,
                valores: { pecas: m.areaPecas, sobra: m.sobraUtil, perda: m.desperdicio },
              }))}
            />
          </Cartao>
          <Cartao
            titulo={comPreco ? 'Economia por mês' : 'Chapas economizadas por mês'}
            descricao={`Comparado a cortar com ${formatar(d.referencia, 'pct')} de aproveitamento. Barra abaixo de zero: gastou mais que a referência.`}
          >
            <BarrasMensais
              titulo="Economia por mês"
              formato={comPreco ? 'reais' : 'chapas'}
              formatoEixo={comPreco ? 'reaisCurto' : 'chapas'}
              series={[
                {
                  chave: 'v',
                  rotulo: 'Economia',
                  cor: 'var(--viz-1)',
                  corNegativa: 'var(--viz-neg)',
                },
              ]}
              pontos={d.mensal.map((m, i) => ({
                ...pontos[i]!,
                valores: { v: comPreco ? m.economiaReais : m.economiaChapas },
                detalhes: comPreco ? [`${formatar(m.economiaChapas, 'chapas')}`] : undefined,
              }))}
            />
          </Cartao>
        </div>

        <Cartao titulo="Por material" descricao="Materiais cortados no período.">
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[40rem] text-sm tabular-nums">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 font-medium">Material</th>
                  <th className="py-2 text-right font-medium">Chapas</th>
                  <th className="py-2 pl-4 font-medium">Aproveitamento</th>
                  <th className="py-2 text-right font-medium">Desperdício</th>
                  <th className="py-2 text-right font-medium">Custo</th>
                  <th className="py-2 text-right font-medium">Economia</th>
                </tr>
              </thead>
              <tbody>
                {d.materiais.map((m) => (
                  <tr key={m.materialId} className="border-b last:border-0">
                    <td className="py-2.5 pr-3 font-medium">{m.descricao}</td>
                    <td className="py-2.5 text-right">{m.chapas}</td>
                    <td className="py-2.5 pl-4">
                      <BarraPct valor={m.aproveitamento} referencia={d.referencia} />
                    </td>
                    <td className="py-2.5 text-right">
                      {formatar(m.desperdicio, 'm2')}
                      {m.temPreco && (
                        <span className="block text-xs text-muted-foreground">
                          {formatar(m.custoDesperdicio, 'reais')}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      {m.temPreco ? formatar(m.custo, 'reais') : 'sem preço'}
                    </td>
                    <td
                      className={cn(
                        'py-2.5 text-right',
                        m.economiaChapas < 0 && 'text-destructive',
                      )}
                    >
                      {m.temPreco
                        ? formatar(m.economiaReais, 'reais')
                        : formatar(m.economiaChapas, 'chapas')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Cartao>

        <div className="grid gap-6 lg:grid-cols-2">
          <ListaProjetos
            titulo="Menor aproveitamento"
            descricao="Vale revisar: peças grandes, poucas peças ou material só com sobra."
            projetos={d.piores}
          />
          <ListaProjetos
            titulo="Maior aproveitamento"
            descricao="Os planos que melhor usaram as chapas."
            projetos={d.melhores}
          />
        </div>

        <Cartao titulo="Como a economia é calculada">
          <div className="grid gap-6 text-sm text-muted-foreground lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="space-y-2">
              <p>
                <strong>Aproveitamento</strong> é a área das peças dividida pela área de chapa
                consumida. As <strong>sobras úteis</strong> (retalhos acima da sobra mínima da
                máquina) não contam como consumidas, porque voltam ao estoque. O aproveitamento
                bruto conta a chapa inteira.
              </p>
              <p>
                Para cada material, o painel calcula quantas chapas seriam necessárias com o{' '}
                <strong>aproveitamento de referência</strong> e compara com as consumidas. A
                diferença, vezes o preço da chapa, é a economia. Use como referência o que a
                marcenaria aproveitava antes. <strong>Desperdício</strong> é o que não virou peça
                nem sobra útil: serra, refilos e retalhos pequenos.
              </p>
            </div>
            {ehAdmin ? (
              <Referencia valor={d.referencia} />
            ) : (
              <p>
                Referência atual: <strong>{formatar(d.referencia, 'pct')}</strong>
              </p>
            )}
          </div>
        </Cartao>
      </div>
    </>
  );
}

function Cartao({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={titulo} className="min-w-0 rounded-xl border bg-card p-5">
      <h2 className="font-semibold">{titulo}</h2>
      {descricao && <p className="mt-0.5 mb-4 text-sm text-muted-foreground">{descricao}</p>}
      {!descricao && <div className="mb-4" />}
      {children}
    </section>
  );
}

function Indicador({
  rotulo,
  valor,
  detalhe,
  delta,
  formatoDelta,
  bomSeSobe = false,
  destaque,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
  delta?: number | null;
  formatoDelta?: (v: number) => string;
  bomSeSobe?: boolean;
  destaque?: 'bom' | 'ruim';
}) {
  let Seta: LucideIcon | null = null;
  let bom = false;
  if (delta != null && formatoDelta && Math.abs(delta) >= 0.0005) {
    Seta = delta > 0 ? ArrowUpRight : ArrowDownRight;
    bom = delta > 0 === bomSeSobe;
  }
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{rotulo}</p>
      <p
        className={cn(
          'mt-1 text-3xl font-semibold tracking-tight tabular-nums',
          destaque === 'ruim' && 'text-destructive',
        )}
      >
        {valor}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>
      {Seta && formatoDelta && delta != null && (
        <p
          className={cn(
            'mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
            bom ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive',
          )}
        >
          <Seta className="size-3.5" aria-hidden />
          {formatoDelta(delta)} vs. período anterior
        </p>
      )}
    </div>
  );
}

function Mini({ rotulo, valor, dica }: { rotulo: string; valor: string; dica?: string }) {
  return (
    <div className="bg-card px-5 py-3" title={dica}>
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className="text-lg font-semibold tabular-nums">{valor}</p>
    </div>
  );
}

function BarraPct({ valor, referencia }: { valor: number; referencia: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2 w-28 rounded-full bg-muted">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${Math.min(100, valor * 100)}%`, background: 'var(--viz-1)' }}
        />
        <div
          className="absolute -inset-y-1 w-0.5 bg-foreground/60"
          style={{ left: `${referencia * 100}%` }}
          title="Referência"
        />
      </div>
      <span>{formatar(valor, 'pct')}</span>
    </div>
  );
}

function ListaProjetos({
  titulo,
  descricao,
  projetos,
}: {
  titulo: string;
  descricao: string;
  projetos: LinhaProjeto[];
}) {
  return (
    <Cartao titulo={titulo} descricao={descricao}>
      <ul className="divide-y">
        {projetos.map((p) => (
          <li key={p.id}>
            <Link
              href={`/projetos/${p.id}?aba=plano`}
              className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{p.nome}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {p.cliente} · {p.chapas} chapas · {formatar(p.desperdicio, 'm2')} perdidos
                </span>
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {formatar(p.aproveitamento, 'pct')}
              </span>
            </Link>
          </li>
        ))}
        {projetos.length === 0 && (
          <li className="py-2 text-sm text-muted-foreground">Nenhum projeto no período.</li>
        )}
      </ul>
    </Cartao>
  );
}
