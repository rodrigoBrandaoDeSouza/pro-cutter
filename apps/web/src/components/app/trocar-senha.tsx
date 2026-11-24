'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { trocarMinhaSenha } from '@/app/(app)/conta/actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Campo, useAcao } from './form';

export function DialogoTrocarSenha({
  aberto,
  aoMudar,
}: {
  aberto: boolean;
  aoMudar: (v: boolean) => void;
}) {
  const [f, setF] = useState({ atual: '', nova: '', confirmacao: '' });
  const { executar, pendente, erros, limparErros } = useAcao(trocarMinhaSenha, {
    aoConcluir: () => aoMudar(false),
  });
  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        aoMudar(v);
        if (v) {
          limparErros();
          setF({ atual: '', nova: '', confirmacao: '' });
        }
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            executar(f);
          }}
        >
          <DialogHeader>
            <DialogTitle>Trocar minha senha</DialogTitle>
            <DialogDescription>
              Outros aparelhos conectados com a senha antiga serão desconectados.
            </DialogDescription>
          </DialogHeader>
          {(
            [
              ['atual', 'Senha atual', 'current-password'],
              ['nova', 'Nova senha', 'new-password'],
              ['confirmacao', 'Repita a nova senha', 'new-password'],
            ] as const
          ).map(([k, rotulo, auto]) => (
            <Campo
              key={k}
              id={`ts-${k}`}
              rotulo={rotulo}
              erro={erros[k]}
              dica={k === 'nova' ? 'Mínimo de 8 caracteres.' : undefined}
            >
              <Input
                id={`ts-${k}`}
                type="password"
                autoComplete={auto}
                value={f[k]}
                onChange={(e) => setF({ ...f, [k]: e.target.value })}
                aria-invalid={!!erros[k]}
                autoFocus={k === 'atual'}
              />
            </Campo>
          ))}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => aoMudar(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pendente}>
              Trocar senha
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Aviso fixo enquanto a pessoa usa uma senha definida por outra (seed ou admin). */
export function AvisoTrocarSenha({ aoTrocar }: { aoTrocar: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 border-b border-warning/40 bg-warning/10 px-4 py-2.5 text-sm sm:px-8"
    >
      <KeyRound className="size-4 shrink-0 text-warning" />
      <span className="flex-1">
        <strong className="font-semibold">Sua senha foi definida por outra pessoa.</strong> Troque
        por uma só sua para proteger o acesso.
      </span>
      <Button size="sm" onClick={aoTrocar}>
        Trocar senha
      </Button>
    </div>
  );
}
