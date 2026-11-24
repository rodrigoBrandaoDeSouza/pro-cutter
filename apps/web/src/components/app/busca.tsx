'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

/** Busca que atualiza ?q= na URL enquanto digita (com pequeno atraso), preservando os outros filtros. */
export function Busca({
  inicial,
  rotulo = 'Buscar',
  placeholder = 'Buscar',
}: {
  inicial: string;
  rotulo?: string;
  placeholder?: string;
}) {
  const [q, setQ] = useState(inicial);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    if (q === inicial) return;
    const t = setTimeout(() => {
      const p = new URLSearchParams(params);
      if (q) p.set('q', q);
      else p.delete('q');
      const s = p.toString();
      router.replace(s ? `${pathname}?${s}` : pathname);
    }, 250);
    return () => clearTimeout(t);
  }, [q, inicial, pathname, router, params]);

  return (
    <div className="relative w-full max-w-sm">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder={placeholder}
        aria-label={rotulo}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="pl-8"
      />
    </div>
  );
}
