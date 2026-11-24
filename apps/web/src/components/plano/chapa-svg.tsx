'use client';

import { useId } from 'react';
import { cn } from 'cn';
import type { Geometria, Nivel, Peca } from '@pro-cutter/core';

/** Cor das linhas de corte por nível (classe de stroke). */
export const COR_NIVEL: Record<Nivel, string> = {
  '1X': 'stroke-foreground',
  '1Y': 'stroke-foreground',
  '2X': 'stroke-sky-600 dark:stroke-sky-400',
  '2Y': 'stroke-sky-600 dark:stroke-sky-400',
  '3X': 'stroke-violet-600 dark:stroke-violet-400',
  '3Y': 'stroke-violet-600 dark:stroke-violet-400',
  '4X': 'stroke-violet-600',
  '4Y': 'stroke-violet-600',
};

export interface ChapaSvgProps {
  comprimento: number;
  largura: number;
  geometria: Geometria;
  pecas: Map<string, Peca>;
  /** Número de etiqueta de cada peça posicionada (mesma ordem de geometria.pecas). */
  numeros: number[];
  temVeio?: boolean;
  mini?: boolean;
  /** Índice da peça posicionada selecionada. */
  selecionada?: number;
  aoSelecionar?: (indice: number) => void;
  /** Índices (em geometria.pecas) das peças fixadas pelo usuário. */
  fixadas?: Set<number>;
  /** Modo sequência: índice do corte atual (os anteriores já foram feitos). */
  corteAtual?: number;
  className?: string;
}

export function ChapaSvg({
  comprimento: C,
  largura: L,
  geometria: g,
  pecas,
  numeros,
  temVeio,
  mini,
  selecionada,
  aoSelecionar,
  fixadas,
  corteAtual,
  className,
}: ChapaSvgProps) {
  const uid = useId().replace(/:/g, '');
  const traco = mini ? 6 : 3; // espessura das linhas em mm (o SVG está em mm)
  const emSequencia = corteAtual !== undefined;

  return (
    <svg
      viewBox={`-10 -10 ${C + 20} ${L + 20}`}
      className={cn('block h-auto w-full select-none', className)}
      role="img"
      aria-label={`Chapa ${C} × ${L} mm com ${g.pecas.length} peças`}
    >
      <defs>
        <pattern
          id={`sobra-${uid}`}
          width="24"
          height="24"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="24" strokeWidth="6" className="stroke-success/35" />
        </pattern>
        <pattern id={`veio-${uid}`} width="60" height="18" patternUnits="userSpaceOnUse">
          <path
            d="M0 9 Q15 5 30 9 T60 9"
            fill="none"
            strokeWidth="1.2"
            className="stroke-foreground/8"
          />
        </pattern>
      </defs>

      {/* chapa */}
      <rect
        x="0"
        y="0"
        width={C}
        height={L}
        rx="4"
        className="fill-muted stroke-border"
        strokeWidth={traco}
      />
      {temVeio && <rect x="0" y="0" width={C} height={L} fill={`url(#veio-${uid})`} />}

      {/* sobras */}
      {g.sobras.map((s, i) => (
        <rect
          key={`s${i}`}
          x={s.x}
          y={s.y}
          width={s.c}
          height={s.l}
          className={s.util ? 'stroke-success/50' : 'fill-foreground/5'}
          fill={s.util ? `url(#sobra-${uid})` : undefined}
          strokeWidth={s.util ? traco / 2 : 0}
        >
          <title>{`${s.util ? 'Sobra útil' : 'Perda'} ${Math.round(s.c)} × ${Math.round(s.l)}`}</title>
        </rect>
      ))}

      {/* peças */}
      {g.pecas.map((pp, i) => {
        const p = pecas.get(pp.pecaId);
        const ativa = selecionada === i;
        const fixa = fixadas?.has(i);
        const girada = !!p && pp.c !== p.comprimento;
        const fita = p?.fita ?? [0, 0, 0, 0];
        // Sem giro: bordas do comprimento ficam em cima/embaixo; girada, ficam nas laterais
        const [cima, baixo, esq, dir] = girada
          ? [fita[2], fita[3], fita[0], fita[1]]
          : [fita[0], fita[1], fita[2], fita[3]];
        const fonte = Math.min(mini ? 90 : 46, Math.max(16, Math.min(pp.c, pp.l) / 3.2));
        const cabeTexto = !mini && pp.c > fonte * 3.2 && pp.l > fonte * 1.4;
        const cabeMedida = !mini && pp.c > fonte * 7 && pp.l > fonte * 3;
        return (
          <g
            key={`p${i}`}
            onClick={aoSelecionar ? () => aoSelecionar(i) : undefined}
            className={cn(aoSelecionar && 'cursor-pointer')}
            role={aoSelecionar ? 'button' : undefined}
            aria-label={
              aoSelecionar ? `Peça ${numeros[i]}: ${p?.nome ?? ''} ${pp.c} × ${pp.l}` : undefined
            }
            aria-pressed={aoSelecionar ? ativa : undefined}
          >
            <rect
              x={pp.x}
              y={pp.y}
              width={pp.c}
              height={pp.l}
              className={cn(
                'transition-colors',
                ativa ? 'fill-primary/45 stroke-primary' : 'fill-card stroke-primary/50',
                aoSelecionar && !ativa && 'hover:fill-primary/15',
              )}
              strokeWidth={ativa ? traco * 1.6 : traco / 1.5}
              strokeDasharray={fixa ? `${traco * 5} ${traco * 3}` : undefined}
            />
            {!mini && (
              <g
                className="stroke-primary"
                strokeWidth={traco * 2.2}
                strokeLinecap="butt"
                pointerEvents="none"
              >
                {cima > 0 && (
                  <line x1={pp.x} y1={pp.y + traco} x2={pp.x + pp.c} y2={pp.y + traco} />
                )}
                {baixo > 0 && (
                  <line
                    x1={pp.x}
                    y1={pp.y + pp.l - traco}
                    x2={pp.x + pp.c}
                    y2={pp.y + pp.l - traco}
                  />
                )}
                {esq > 0 && <line x1={pp.x + traco} y1={pp.y} x2={pp.x + traco} y2={pp.y + pp.l} />}
                {dir > 0 && (
                  <line
                    x1={pp.x + pp.c - traco}
                    y1={pp.y}
                    x2={pp.x + pp.c - traco}
                    y2={pp.y + pp.l}
                  />
                )}
              </g>
            )}
            {cabeTexto && (
              <text
                x={pp.x + pp.c / 2}
                y={pp.y + pp.l / 2 + (cabeMedida ? -fonte * 0.15 : fonte * 0.35)}
                textAnchor="middle"
                fontSize={fonte}
                className="fill-foreground font-semibold"
                pointerEvents="none"
              >
                {fixa ? '📌 ' : ''}
                {numeros[i]}
              </text>
            )}
            {cabeMedida && (
              <text
                x={pp.x + pp.c / 2}
                y={pp.y + pp.l / 2 + fonte * 0.95}
                textAnchor="middle"
                fontSize={fonte * 0.72}
                className="fill-muted-foreground"
                pointerEvents="none"
              >
                {fmt(pp.c)} × {fmt(pp.l)}
              </text>
            )}
          </g>
        );
      })}

      {/* cortes */}
      {!mini &&
        g.cortes.map((c, i) => {
          const [x1, y1, x2, y2] =
            c.eixo === 'X' ? [c.pos, c.de, c.pos, c.ate] : [c.de, c.pos, c.ate, c.pos];
          const feito = !emSequencia || i < corteAtual!;
          const atual = emSequencia && i === corteAtual;
          if (emSequencia && !feito && !atual) {
            return (
              <line
                key={`c${i}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                strokeWidth={traco / 2}
                strokeDasharray="10 10"
                className="stroke-foreground/25"
              />
            );
          }
          return (
            <g key={`c${i}`} pointerEvents="none">
              {/* halo largo para o corte atual ser achado mesmo quando é curto */}
              {atual && (
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  strokeWidth={traco * 14}
                  strokeLinecap="round"
                  className="stroke-primary/25"
                />
              )}
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                strokeWidth={atual ? traco * 3 : traco / 1.2}
                strokeDasharray={c.refilo && !atual ? '14 8' : undefined}
                className={atual ? 'stroke-primary' : cn(COR_NIVEL[c.nivel], 'opacity-70')}
              />
            </g>
          );
        })}
    </svg>
  );
}

export function fmt(v: number): string {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}
