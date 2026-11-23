import { cn } from 'cn';
import { BORDAS } from '@/lib/bordas';

/**
 * Desenho mínimo da peça com as bordas que levam fita destacadas.
 * fita = [comprimento superior, comprimento inferior, largura esquerda, largura direita].
 */
export function MiniFita({ fita, className }: { fita: readonly number[]; className?: string }) {
  const com = BORDAS.filter((_, i) => (fita[i] ?? 0) > 0);
  const titulo = com.length ? `Fita: ${com.join(', ').toLowerCase()}` : 'Sem fita';
  const lado = (i: number) => ((fita[i] ?? 0) > 0 ? 'stroke-primary' : 'stroke-border');
  return (
    <svg
      viewBox="0 0 28 18"
      className={cn('h-4.5 w-7 shrink-0', className)}
      role="img"
      aria-label={titulo}
    >
      <title>{titulo}</title>
      <rect x="3" y="3" width="22" height="12" className="fill-muted" />
      <line x1="3" y1="3" x2="25" y2="3" strokeWidth="2.5" className={lado(0)} />
      <line x1="3" y1="15" x2="25" y2="15" strokeWidth="2.5" className={lado(1)} />
      <line x1="3" y1="3" x2="3" y2="15" strokeWidth="2.5" className={lado(2)} />
      <line x1="25" y1="3" x2="25" y2="15" strokeWidth="2.5" className={lado(3)} />
    </svg>
  );
}
