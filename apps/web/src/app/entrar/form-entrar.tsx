'use client';

import { useActionState } from 'react';
import { CircleAlert, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { entrarAction, type EstadoEntrar } from './actions';

export function FormEntrar({ de }: { de?: string }) {
  const [estado, acao, pendente] = useActionState<EstadoEntrar, FormData>(entrarAction, {});

  return (
    <form action={acao} className="mt-8 space-y-5">
      {de && <input type="hidden" name="de" value={de} />}
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          defaultValue={estado.email}
          aria-invalid={!!estado.erro}
          className="h-11"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="senha">Senha</Label>
        <Input
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={!!estado.erro}
          className="h-11"
        />
      </div>
      {estado.erro && (
        <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
          <CircleAlert className="size-4 shrink-0" />
          {estado.erro}
        </p>
      )}
      <Button type="submit" className="h-11 w-full text-base" disabled={pendente}>
        {pendente && <Loader2 className="animate-spin" />}
        Entrar
      </Button>
    </form>
  );
}
