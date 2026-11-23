'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ParametroRegra } from '@pro-cutter/regras';
import { useAcao } from '@/components/app/form';
import { mmBR, Secao } from '@/components/app/secao';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { salvarRegras } from './actions';

interface Linha {
  chave: string;
  rotulo: string;
  valor: string;
  unidade: string;
  grupo: string;
  ajuda?: string;
  nova?: boolean;
}

export function AbaRegras({ regras }: { regras: ParametroRegra[] }) {
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    regras.map((r) => ({
      chave: r.chave,
      rotulo: r.rotulo,
      valor: mmBR(r.valor),
      unidade: r.unidade ?? '',
      grupo: r.grupo ?? '',
      ajuda: r.ajuda,
    })),
  );
  const { executar, pendente, erros } = useAcao(salvarRegras);
  const grupos = useMemo(() => [...new Set(linhas.map((l) => l.grupo || 'Outros'))], [linhas]);

  const mudar = (i: number, campo: keyof Linha, valor: string) =>
    setLinhas(linhas.map((l, k) => (k === i ? { ...l, [campo]: valor } : l)));

  return (
    <Secao
      titulo="Parâmetros de regra"
      descricao={
        <>
          Valores usados nas fórmulas (ex.: <code className="text-xs">portaFolgaExt</code>). Cada
          projeto copia estes valores ao ser criado e pode ajustar; cada módulo também.
        </>
      }
      acao={
        <Button
          variant="outline"
          onClick={() =>
            setLinhas([
              ...linhas,
              { chave: '', rotulo: '', valor: '0', unidade: 'mm', grupo: 'Outros', nova: true },
            ])
          }
        >
          <Plus /> Novo parâmetro
        </Button>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          executar(
            linhas.map((l) => ({
              chave: l.chave,
              rotulo: l.rotulo,
              valor: l.valor.replace(',', '.'),
              unidade: l.unidade || undefined,
              grupo: l.grupo || undefined,
              ajuda: l.ajuda,
            })),
          );
        }}
        className="space-y-6"
      >
        {grupos.map((g) => (
          <fieldset key={g} className="space-y-2">
            <legend className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {g}
            </legend>
            {linhas.map((l, i) =>
              (l.grupo || 'Outros') !== g ? null : (
                <div
                  key={i}
                  className="grid items-center gap-2 rounded-lg border px-3 py-2 sm:grid-cols-[1fr_10rem_6rem_2.25rem]"
                >
                  {l.nova ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input
                        placeholder="Rótulo (ex.: Recuo da prateleira)"
                        aria-label="Rótulo do parâmetro"
                        value={l.rotulo}
                        onChange={(e) => mudar(i, 'rotulo', e.target.value)}
                      />
                      <Input
                        placeholder="nome na fórmula (ex.: recuoPrat)"
                        aria-label="Nome na fórmula"
                        className="font-mono text-xs"
                        value={l.chave}
                        onChange={(e) => mudar(i, 'chave', e.target.value)}
                        aria-invalid={!!erros[`${i}.chave`]}
                      />
                      {erros[`${i}.chave`] && (
                        <p className="text-xs text-destructive sm:col-span-2">
                          {erros[`${i}.chave`]}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm font-medium">{l.rotulo}</div>
                      <code className="text-xs text-muted-foreground">{l.chave}</code>
                      {l.ajuda && <p className="text-xs text-muted-foreground">{l.ajuda}</p>}
                    </div>
                  )}
                  <Input
                    inputMode="decimal"
                    aria-label={`Valor de ${l.rotulo || l.chave || 'novo parâmetro'}`}
                    value={l.valor}
                    onChange={(e) => mudar(i, 'valor', e.target.value)}
                    aria-invalid={!!erros[`${i}.valor`]}
                    className="text-right tabular-nums"
                  />
                  <span className="text-sm text-muted-foreground">{l.unidade}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover ${l.rotulo || 'parâmetro'}`}
                    onClick={() => setLinhas(linhas.filter((_, k) => k !== i))}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ),
            )}
          </fieldset>
        ))}
        {erros._ && <p className="text-sm text-destructive">{erros._}</p>}
        <Button type="submit" disabled={pendente}>
          Salvar regras
        </Button>
      </form>
    </Secao>
  );
}
