'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { TipoModulo, ValoresRegras } from '@pro-cutter/regras';
import { useAcao } from '@/components/app/form';
import { mmBR, Secao } from '@/components/app/secao';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { atualizarFormulasDoProjeto, salvarRegrasProjeto } from './actions-pecas';
import type { ParametroVM } from './tipos';

export function AbaRegrasProjeto({
  projetoId,
  regras,
  parametros,
  tipos,
}: {
  projetoId: string;
  regras: ValoresRegras;
  parametros: ParametroVM[];
  tipos: TipoModulo[];
}) {
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(regras).map(([k, v]) => [k, mmBR(v)])),
  );
  const salvar = useAcao(salvarRegrasProjeto);
  const atualizar = useAcao(atualizarFormulasDoProjeto);
  const grupos = [...new Set(parametros.map((p) => p.grupo ?? 'Outros'))];

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <Secao
        titulo="Regras deste projeto"
        descricao="Copiadas das Configurações quando o projeto foi criado. Ao salvar, as portas e fundos de todos os módulos são recalculados."
      >
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            salvar.executar({
              projetoId,
              regras: Object.fromEntries(
                Object.entries(valores).map(([k, v]) => [k, v.replace(',', '.')]),
              ),
            });
          }}
        >
          {grupos.map((g) => (
            <fieldset key={g} className="space-y-2">
              <legend className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {g}
              </legend>
              {parametros
                .filter((p) => (p.grupo ?? 'Outros') === g)
                .map((p) => {
                  const diferente =
                    p.padrao !== undefined &&
                    Number((valores[p.chave] ?? '').replace(',', '.')) !== p.padrao;
                  return (
                    <div
                      key={p.chave}
                      className="grid items-center gap-2 rounded-lg border px-3 py-2 sm:grid-cols-[1fr_9rem_3rem]"
                    >
                      <div>
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {p.rotulo}
                          {diferente && <Badge variant="outline">ajustado</Badge>}
                        </div>
                        <code className="text-xs text-muted-foreground">{p.chave}</code>
                        {p.padrao !== undefined && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            padrão {mmBR(p.padrao)}
                          </span>
                        )}
                      </div>
                      <Input
                        inputMode="decimal"
                        aria-label={`Valor de ${p.rotulo}`}
                        value={valores[p.chave] ?? ''}
                        onChange={(e) => setValores({ ...valores, [p.chave]: e.target.value })}
                        className="text-right tabular-nums"
                      />
                      <span className="text-sm text-muted-foreground">{p.unidade}</span>
                    </div>
                  );
                })}
            </fieldset>
          ))}
          <Button type="submit" disabled={salvar.pendente}>
            Salvar e recalcular
          </Button>
        </form>
      </Secao>

      <Secao
        titulo="Fórmulas do projeto"
        descricao="Tipos de módulo copiados das Configurações."
        acao={
          <Button
            variant="outline"
            size="sm"
            disabled={atualizar.pendente}
            onClick={() => atualizar.executar(projetoId)}
          >
            <RefreshCw /> Atualizar
          </Button>
        }
      >
        <ul className="space-y-2 text-sm">
          {tipos.map((t) => (
            <li key={t.id} className="flex justify-between gap-2">
              <span>{t.nome}</span>
              <span className="text-xs text-muted-foreground">
                {t.pecas.map((p) => p.nome).join(', ')}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          “Atualizar” traz as fórmulas atuais das Configurações e recalcula os módulos. Os valores
          ajustados neste projeto são mantidos.
        </p>
      </Secao>
    </div>
  );
}
