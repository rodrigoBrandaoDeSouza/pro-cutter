import { cn } from 'cn';
import { COR_STATUS, ROTULO_STATUS, type Status } from '@/lib/status';

export function SeloStatus({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap',
        COR_STATUS[status],
        className,
      )}
    >
      {ROTULO_STATUS[status]}
    </span>
  );
}

/** "há 5 min", "ontem", "12/11" — datas relativas curtas em português. */
export function quando(iso: string, agora = Date.now()): string {
  const d = new Date(iso);
  const s = Math.round((agora - d.getTime()) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  if (s < 2 * 86400) return 'ontem';
  if (s < 7 * 86400) return `há ${Math.floor(s / 86400)} dias`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
