'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import type { Resultado } from '@/lib/acao';
import { useAcao } from './form';

/** Botão de excluir com confirmação. `bloqueio` explica por que não pode excluir (desabilita). */
export function BotaoExcluir({
  rotulo,
  titulo,
  descricao = 'Esta ação não pode ser desfeita.',
  bloqueio,
  acao,
  tamanho = 'icon',
}: {
  rotulo: string;
  titulo: string;
  descricao?: string;
  bloqueio?: string;
  acao: () => Promise<Resultado<unknown>>;
  tamanho?: 'icon' | 'icon-sm';
}) {
  const [aberto, setAberto] = useState(false);
  const { executar, pendente } = useAcao(acao, { aoConcluir: () => setAberto(false) });
  return (
    <AlertDialog open={aberto} onOpenChange={setAberto}>
      <AlertDialogTrigger render={<Button variant="ghost" size={tamanho} aria-label={rotulo} />}>
        <Trash2 />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{bloqueio ?? descricao}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pendente || !!bloqueio}
            onClick={() => executar(undefined)}
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
