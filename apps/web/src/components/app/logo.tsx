import { cn } from 'cn';

/** Marca: uma chapa com cortes guilhotina. */
export function LogoMarca({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('size-8', className)}>
      <rect x="1" y="1" width="30" height="30" rx="8" className="fill-primary" />
      <rect x="7" y="8" width="18" height="16" rx="1.5" className="fill-primary-foreground/95" />
      <path d="M7 15.5h18M16 8v7.5M12 15.5V24" className="stroke-primary" strokeWidth="1.6" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2 font-semibold tracking-tight', className)}>
      <LogoMarca />
      <span className="text-lg">
        pro<span className="text-primary">-cutter</span>
      </span>
    </span>
  );
}
