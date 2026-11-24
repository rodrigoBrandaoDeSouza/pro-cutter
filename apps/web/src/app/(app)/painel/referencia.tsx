'use client';

import { useState } from 'react';
import { Campo, useAcao } from '@/components/app/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { salvarReferencia } from './actions';

export function Referencia({ valor }: { valor: number }) {
  const [texto, setTexto] = useState(String(Math.round(valor * 1000) / 10).replace('.', ','));
  const { executar, pendente, erros } = useAcao(salvarReferencia);
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        executar({ percentual: texto.replace(',', '.') });
      }}
    >
      <Campo
        id="ref-aprov"
        rotulo="Aproveitamento de referência (%)"
        erro={erros.percentual}
        className="flex-1"
      >
        <Input
          id="ref-aprov"
          inputMode="decimal"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          aria-invalid={!!erros.percentual}
          className="text-right tabular-nums"
        />
      </Campo>
      <Button type="submit" variant="outline" disabled={pendente}>
        Salvar
      </Button>
    </form>
  );
}
