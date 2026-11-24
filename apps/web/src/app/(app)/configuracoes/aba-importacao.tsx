'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Campo, SelectNativo, useAcao } from '@/components/app/form';
import { mmBR, Secao } from '@/components/app/secao';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BORDAS } from '@/lib/bordas';
import { salvarEtiqueta, salvarImportacao } from './actions';

type Borda = 0 | 1 | 2 | 3;
export interface ImportacaoForm {
  mapaGrupos: Record<string, string>;
  origemPorTipo: Record<string, 'promob' | 'pro-cutter'>;
  ladosFita: [Borda, Borda, Borda, Borda];
}

const TIPOS = ['base', 'lateral', 'sarrafo', 'porta', 'fundo', 'prateleira', 'frente', 'outro'];
const TIPOS_GERAVEIS = ['porta', 'fundo', 'prateleira', 'frente'];

export function AbaImportacao({
  importacao,
  etiqueta,
}: {
  importacao: ImportacaoForm;
  etiqueta: { largura: number; altura: number };
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <FormImportacao inicial={importacao} />
      <FormEtiqueta inicial={etiqueta} />
    </div>
  );
}

function FormImportacao({ inicial }: { inicial: ImportacaoForm }) {
  const [grupos, setGrupos] = useState(() => Object.entries(inicial.mapaGrupos));
  const [origem, setOrigem] = useState(inicial.origemPorTipo);
  const [lados, setLados] = useState(inicial.ladosFita);
  const { executar, pendente, erros } = useAcao(salvarImportacao);

  return (
    <form
      className="grid gap-6 xl:col-span-2 xl:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        executar({
          mapaGrupos: Object.fromEntries(grupos.filter(([g]) => g.trim())),
          origemPorTipo: origem,
          ladosFita: lados,
        });
      }}
    >
      <Secao
        titulo="Grupos do Promob"
        descricao="Como cada grupo da listagem (campo GROUP) vira um tipo de peça no pro-cutter."
        acao={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setGrupos([...grupos, ['', 'outro']])}
          >
            <Plus /> Grupo
          </Button>
        }
      >
        <div className="space-y-2">
          {grupos.map(([g, t], i) => (
            <div key={i} className="grid grid-cols-[1fr_9rem_2.25rem] items-center gap-2">
              <Input
                aria-label="Grupo no Promob"
                placeholder="Ex.: Prateleiras"
                value={g}
                onChange={(e) =>
                  setGrupos(grupos.map((x, k) => (k === i ? [e.target.value, x[1]] : x)))
                }
              />
              <SelectNativo
                aria-label={`Tipo de peça para ${g || 'novo grupo'}`}
                value={t}
                onChange={(e) =>
                  setGrupos(grupos.map((x, k) => (k === i ? [x[0], e.target.value] : x)))
                }
              >
                {[...new Set([...TIPOS, t])].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </SelectNativo>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remover grupo ${g}`}
                onClick={() => setGrupos(grupos.filter((_, k) => k !== i))}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      </Secao>

      <div className="space-y-6">
        <Secao
          titulo="Quem fornece cada peça"
          descricao="Se o pro-cutter gera, as peças desse tipo que vierem no XML são ignoradas (evita duplicar)."
        >
          <div className="space-y-3">
            {TIPOS_GERAVEIS.map((t) => (
              <div key={t} className="grid grid-cols-[1fr_14rem] items-center gap-3">
                <span className="text-sm capitalize">{t}</span>
                <SelectNativo
                  aria-label={`Origem de ${t}`}
                  value={origem[t] ?? 'promob'}
                  onChange={(e) =>
                    setOrigem({ ...origem, [t]: e.target.value as 'promob' | 'pro-cutter' })
                  }
                >
                  <option value="promob">Vem do Promob</option>
                  <option value="pro-cutter">Gera pelo pro-cutter</option>
                </SelectNativo>
              </div>
            ))}
          </div>
        </Secao>

        <Secao
          titulo="Lados da fita no Promob"
          descricao="A qual borda da peça corresponde cada FITA_BORDA do XML. O padrão é um palpite: confira com uma peça real."
        >
          <div className="space-y-3">
            {lados.map((b, i) => (
              <div key={i} className="grid grid-cols-[1fr_14rem] items-center gap-3">
                <span className="text-sm">
                  Lado {i + 1}{' '}
                  <code className="text-xs text-muted-foreground">FITA_BORDA_{i + 1}</code>
                </span>
                <SelectNativo
                  aria-label={`Borda do lado ${i + 1}`}
                  value={b}
                  onChange={(e) => {
                    const novo = [...lados] as ImportacaoForm['ladosFita'];
                    novo[i] = Number(e.target.value) as Borda;
                    setLados(novo);
                  }}
                >
                  {BORDAS.map((rotulo, k) => (
                    <option key={k} value={k}>
                      {rotulo}
                    </option>
                  ))}
                </SelectNativo>
              </div>
            ))}
            {erros.ladosFita && <p className="text-xs text-destructive">{erros.ladosFita}</p>}
          </div>
        </Secao>
        <Button type="submit" disabled={pendente}>
          Salvar importação
        </Button>
      </div>
    </form>
  );
}

function FormEtiqueta({ inicial }: { inicial: { largura: number; altura: number } }) {
  const [largura, setLargura] = useState(mmBR(inicial.largura));
  const [altura, setAltura] = useState(mmBR(inicial.altura));
  const { executar, pendente, erros } = useAcao(salvarEtiqueta);
  const l = Number(largura.replace(',', '.')) || 0;
  const a = Number(altura.replace(',', '.')) || 0;

  return (
    <Secao titulo="Etiqueta" descricao="Tamanho da etiqueta da impressora térmica.">
      <form
        className="flex flex-wrap items-end gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          executar({ largura: largura.replace(',', '.'), altura: altura.replace(',', '.') });
        }}
      >
        <Campo id="e-larg" rotulo="Largura (mm)" erro={erros.largura} className="w-32">
          <Input
            id="e-larg"
            inputMode="decimal"
            value={largura}
            onChange={(e) => setLargura(e.target.value)}
          />
        </Campo>
        <Campo id="e-alt" rotulo="Altura (mm)" erro={erros.altura} className="w-32">
          <Input
            id="e-alt"
            inputMode="decimal"
            value={altura}
            onChange={(e) => setAltura(e.target.value)}
          />
        </Campo>
        <Button type="submit" disabled={pendente}>
          Salvar etiqueta
        </Button>
        {l > 0 && a > 0 && (
          <div
            aria-hidden
            className="ml-auto flex items-center justify-center rounded-md border-2 border-dashed text-xs text-muted-foreground"
            style={{ width: Math.min(l * 1.6, 220), height: Math.min(a * 1.6, 220) }}
          >
            {mmBR(l)} × {mmBR(a)}
          </div>
        )}
      </form>
    </Secao>
  );
}
