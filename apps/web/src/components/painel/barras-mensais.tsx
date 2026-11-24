'use client';

import { useState } from 'react';
import { cn } from 'cn';
import { formatar as fmt, type Formato } from '@/lib/formatos';

export interface Serie {
  chave: string;
  rotulo: string;
  /** Cor CSS (ex.: var(--viz-1)) */
  cor: string;
  /** Cor quando o valor é negativo (só gráficos de uma série). */
  corNegativa?: string;
}

export interface PontoMes {
  /** AAAA-MM */
  mes: string;
  valores: Record<string, number>;
  /** Linhas extras na dica (ex.: "12 chapas") */
  detalhes?: string[];
  /** Mês sem dado: mostra traço em vez de barra zero. */
  vazio?: boolean;
}

const ALTURA = 200;

export function rotuloMes(mes: string, comAno = false) {
  const [a, m] = mes.split('-').map(Number);
  const nome = new Date(a!, m! - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'short' })
    .replace('.', '');
  return comAno ? `${nome}/${String(a).slice(2)}` : nome;
}

/** Arredonda o topo do eixo para um número "redondo" (1, 2, 2,5, 5 × 10^n). */
function topoRedondo(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const f of [1, 2, 2.5, 5, 10]) if (f * p >= v) return f * p;
  return 10 * p;
}

/**
 * Barras por mês, empilhadas quando há mais de uma série. Valores negativos (uma série só) descem
 * abaixo da linha do zero. Passar o mouse ou focar a coluna mostra a dica com os valores.
 */
export function BarrasMensais({
  titulo,
  pontos,
  series,
  formato,
  formatoEixo = formato,
  referencia,
}: {
  titulo: string;
  pontos: PontoMes[];
  series: Serie[];
  formato: Formato;
  formatoEixo?: Formato;
  referencia?: { valor: number; rotulo: string };
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const formatar = (v: number) => fmt(v, formato);
  const formatarEixo = (v: number) => fmt(v, formatoEixo);
  const somaPos = (p: PontoMes) =>
    series.reduce((s, x) => s + Math.max(0, p.valores[x.chave] ?? 0), 0);
  const minimo = Math.min(0, ...pontos.map((p) => p.valores[series[0]!.chave] ?? 0));
  const topo = topoRedondo(Math.max(...pontos.map(somaPos), referencia?.valor ?? 0, 1e-9));
  const fundo = minimo < 0 ? -topoRedondo(-minimo) : 0;
  const faixa = topo - fundo;
  const y = (v: number) => ((topo - v) / faixa) * ALTURA; // px a partir do topo
  const marcas = fundo < 0 ? [topo, topo / 2, 0, fundo] : [topo, (topo * 2) / 3, topo / 3, 0];

  return (
    <figure aria-label={titulo} className="space-y-3">
      {series.length > 1 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {series.map((s) => (
            <li key={s.chave} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: s.cor }} />
              {s.rotulo}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        {/* Eixo Y */}
        <div className="relative w-12 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
          {marcas.map((m) => (
            <span
              key={m}
              className="absolute right-0 -translate-y-1/2 whitespace-nowrap"
              style={{ top: y(m) }}
            >
              {formatarEixo(m)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1" style={{ height: ALTURA }}>
          {/* Grade */}
          {marcas.map((m) => (
            <div
              key={m}
              className={cn(
                'absolute inset-x-0 border-t',
                m === 0 ? 'border-border' : 'border-border/40',
              )}
              style={{ top: y(m) }}
            />
          ))}
          {referencia && (
            <div
              className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-foreground/50"
              style={{ top: y(referencia.valor) }}
            >
              <span className="absolute -top-5 right-0 rounded bg-background/90 px-1 text-[11px] text-muted-foreground">
                {referencia.rotulo}
              </span>
            </div>
          )}

          <div className="absolute inset-0 flex">
            {pontos.map((p, i) => {
              const v0 = p.valores[series[0]!.chave] ?? 0;
              let acumulado = 0;
              return (
                <div
                  key={p.mes}
                  tabIndex={0}
                  role="img"
                  aria-label={`${rotuloMes(p.mes, true)}: ${
                    p.vazio
                      ? 'sem cortes'
                      : series
                          .map((s) => `${s.rotulo} ${formatar(p.valores[s.chave] ?? 0)}`)
                          .join(', ')
                  }`}
                  onMouseEnter={() => setAtivo(i)}
                  onMouseLeave={() => setAtivo(null)}
                  onFocus={() => setAtivo(i)}
                  onBlur={() => setAtivo(null)}
                  className={cn(
                    'relative flex-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    ativo === i && 'bg-muted/50',
                  )}
                >
                  {!p.vazio &&
                    (v0 < 0 && series.length === 1 ? (
                      <div
                        className="absolute inset-x-[18%] rounded-b-[4px]"
                        style={{
                          top: y(0),
                          height: y(v0) - y(0),
                          background: series[0]!.corNegativa ?? series[0]!.cor,
                        }}
                      />
                    ) : (
                      series.map((s, k) => {
                        const v = Math.max(0, p.valores[s.chave] ?? 0);
                        const base = acumulado;
                        acumulado += v;
                        const ultimo = series
                          .slice(k + 1)
                          .every((x) => (p.valores[x.chave] ?? 0) <= 0);
                        if (v <= 0) return null;
                        return (
                          <div
                            key={s.chave}
                            className={cn('absolute inset-x-[18%]', ultimo && 'rounded-t-[4px]')}
                            style={{
                              top: y(base + v),
                              // 2px de respiro entre segmentos empilhados
                              height: Math.max(1, y(base) - y(base + v) - (k > 0 ? 2 : 0)),
                              background: s.cor,
                            }}
                          />
                        );
                      })
                    ))}
                  {p.vazio && (
                    <span
                      className="absolute inset-x-0 text-center text-xs text-muted-foreground"
                      style={{ top: y(0) - 18 }}
                    >
                      –
                    </span>
                  )}

                  {ativo === i && (
                    <div
                      className={cn(
                        'pointer-events-none absolute top-0 z-20 w-max max-w-52 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg',
                        i < pontos.length / 2 ? 'left-full ml-1' : 'right-full mr-1',
                      )}
                    >
                      <p className="mb-1 font-semibold capitalize">{rotuloMes(p.mes, true)}</p>
                      {p.vazio ? (
                        <p className="text-muted-foreground">Sem cortes no mês</p>
                      ) : (
                        <>
                          {[...series].reverse().map((s) => (
                            <p key={s.chave} className="flex items-center gap-1.5">
                              <span className="size-2 rounded-sm" style={{ background: s.cor }} />
                              <span className="text-muted-foreground">{s.rotulo}</span>
                              <span className="ml-auto pl-3 font-medium tabular-nums">
                                {formatar(p.valores[s.chave] ?? 0)}
                              </span>
                            </p>
                          ))}
                          {p.detalhes?.map((d) => (
                            <p key={d} className="text-muted-foreground">
                              {d}
                            </p>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Eixo X */}
      <div className="ml-14 flex text-[11px] text-muted-foreground">
        {pontos.map((p, i) => (
          <span
            key={p.mes}
            className={cn(
              'flex-1 text-center capitalize',
              pontos.length > 8 && i % 2 === 1 && 'max-sm:invisible',
            )}
          >
            {rotuloMes(p.mes)}
          </span>
        ))}
      </div>

      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          Ver tabela
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full tabular-nums">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-1 text-left font-medium">Mês</th>
                {series.map((s) => (
                  <th key={s.chave} className="py-1 text-right font-medium">
                    {s.rotulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pontos.map((p) => (
                <tr key={p.mes} className="border-b last:border-0">
                  <td className="py-1 capitalize">{rotuloMes(p.mes, true)}</td>
                  {series.map((s) => (
                    <td key={s.chave} className="py-1 text-right">
                      {p.vazio ? '–' : formatar(p.valores[s.chave] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
