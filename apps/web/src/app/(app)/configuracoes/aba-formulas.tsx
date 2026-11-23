'use client';

import { useMemo, useState } from 'react';
import { CircleCheck, CircleX, Copy, Plus, Trash2 } from 'lucide-react';
import { cn } from 'cn';
import type { Fitas, Material } from '@pro-cutter/core';
import {
  gerarPecas,
  validarTipoModulo,
  valoresDe,
  VARIAVEIS_DO_MODULO,
  type ErroRegra,
  type ModeloPeca,
  type ParametroRegra,
  type TipoModulo,
} from '@pro-cutter/regras';
import { Campo, SelectNativo, useAcao } from '@/components/app/form';
import { mmBR, Secao } from '@/components/app/secao';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { salvarTiposModulo } from './actions';

const TIPOS_PECA = ['porta', 'fundo', 'prateleira', 'frente', 'outro'];
import { BORDAS } from '@/lib/bordas';

/** Materiais fictícios da prévia: caixa 15 mm, porta 15 mm com veio, fundo 6 mm. */
const MATERIAIS_PREVIA: Material[] = [
  {
    id: 'caixa',
    descricao: 'Caixa',
    espessura: 15,
    chapa: { comprimento: 2750, largura: 1830 },
    temVeio: false,
  },
  {
    id: 'porta',
    descricao: 'Porta',
    espessura: 15,
    chapa: { comprimento: 2750, largura: 1830 },
    temVeio: true,
  },
  {
    id: 'fundo',
    descricao: 'Fundo',
    espessura: 6,
    chapa: { comprimento: 2750, largura: 1830 },
    temVeio: false,
  },
];

function slug(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const pecaNova = (): ModeloPeca => ({
  nome: 'Nova peça',
  tipo: 'outro',
  material: 'caixa',
  quantidade: '1',
  comprimento: 'A',
  largura: 'L',
  fita: [0, 0, 0, 0],
});

export function AbaFormulas({
  tipos: iniciais,
  regras,
}: {
  tipos: TipoModulo[];
  regras: ParametroRegra[];
}) {
  const [tipos, setTipos] = useState(iniciais);
  const [sel, setSel] = useState(0);
  const { executar, pendente } = useAcao(salvarTiposModulo);
  const chaves = useMemo(() => regras.map((r) => r.chave), [regras]);
  const tipo = tipos[sel];

  const errosPorTipo = useMemo(
    () => tipos.map((t) => validarTipoModulo(t, chaves).length),
    [tipos, chaves],
  );
  const totalErros = errosPorTipo.reduce((a, b) => a + b, 0);

  const atualizar = (t: TipoModulo) => setTipos(tipos.map((x, i) => (i === sel ? t : x)));

  const novoTipo = (base?: TipoModulo) => {
    const nome = base ? `${base.nome} (cópia)` : 'Novo tipo';
    let id = slug(nome);
    for (let n = 2; tipos.some((t) => t.id === id); n++) id = `${slug(nome)}-${n}`;
    const t: TipoModulo = base
      ? { ...structuredClone(base), id, nome }
      : { id, nome, pecas: [pecaNova()] };
    setTipos([...tipos, t]);
    setSel(tipos.length);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
      <nav aria-label="Tipos de módulo" className="space-y-1">
        {tipos.map((t, i) => (
          <button
            key={t.id + i}
            type="button"
            onClick={() => setSel(i)}
            aria-current={i === sel ? 'true' : undefined}
            className={cn(
              'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors',
              i === sel ? 'bg-accent font-medium text-accent-foreground' : 'hover:bg-muted',
            )}
          >
            {t.nome}
            {errosPorTipo[i] ? (
              <CircleX className="size-4 text-destructive" aria-label="com erros" />
            ) : null}
          </button>
        ))}
        <Button variant="outline" className="mt-2 w-full" onClick={() => novoTipo()}>
          <Plus /> Novo tipo
        </Button>
        <div className="sticky top-16 pt-4">
          <Button
            className="w-full"
            disabled={pendente || totalErros > 0}
            onClick={() => executar(tipos)}
          >
            Salvar fórmulas
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            {totalErros > 0
              ? `Corrija ${totalErros} erro(s) antes de salvar.`
              : 'Valem para os próximos projetos.'}
          </p>
        </div>
      </nav>

      {tipo ? (
        <EditorTipo
          key={sel}
          tipo={tipo}
          regras={regras}
          chaves={chaves}
          aoMudar={atualizar}
          aoDuplicar={() => novoTipo(tipo)}
          aoExcluir={
            tipos.length > 1
              ? () => {
                  setTipos(tipos.filter((_, i) => i !== sel));
                  setSel(0);
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}

function EditorTipo({
  tipo,
  regras,
  chaves,
  aoMudar,
  aoDuplicar,
  aoExcluir,
}: {
  tipo: TipoModulo;
  regras: ParametroRegra[];
  chaves: string[];
  aoMudar: (t: TipoModulo) => void;
  aoDuplicar: () => void;
  aoExcluir?: () => void;
}) {
  const mudarPeca = (i: number, p: ModeloPeca) =>
    aoMudar({ ...tipo, pecas: tipo.pecas.map((x, k) => (k === i ? p : x)) });
  const variaveis = [...VARIAVEIS_DO_MODULO, ...(tipo.extras ?? []).map((e) => e.chave), ...chaves];

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <Secao
          titulo={tipo.nome || 'Sem nome'}
          descricao={<code className="text-xs">{tipo.id}</code>}
          acao={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={aoDuplicar}>
                <Copy /> Duplicar
              </Button>
              {aoExcluir && (
                <Button variant="ghost" size="sm" onClick={aoExcluir}>
                  <Trash2 /> Excluir tipo
                </Button>
              )}
            </div>
          }
        >
          <Campo id="t-nome" rotulo="Nome do tipo">
            <Input
              id="t-nome"
              value={tipo.nome}
              onChange={(e) => aoMudar({ ...tipo, nome: e.target.value })}
            />
          </Campo>
        </Secao>

        {tipo.pecas.map((p, i) => (
          <EditorPeca
            key={i}
            peca={p}
            indice={i}
            chaves={chaves}
            tipo={tipo}
            aoMudar={(np) => mudarPeca(i, np)}
            aoRemover={() => aoMudar({ ...tipo, pecas: tipo.pecas.filter((_, k) => k !== i) })}
          />
        ))}
        <Button
          variant="outline"
          onClick={() => aoMudar({ ...tipo, pecas: [...tipo.pecas, pecaNova()] })}
        >
          <Plus /> Adicionar peça
        </Button>
      </div>

      <aside className="space-y-6">
        <Previa tipo={tipo} regras={regras} />
        <Secao titulo="Variáveis" descricao="Podem ser usadas em qualquer fórmula.">
          <div className="flex flex-wrap gap-1.5">
            {variaveis.map((v) => (
              <code key={v} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                {v}
              </code>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Funções: <code>min</code>, <code>max</code>, <code>arred</code>, <code>piso</code>,{' '}
            <code>teto</code>, <code>abs</code>, <code>se(condição; então; senão)</code>. Use
            vírgula decimal e <code>;</code> entre argumentos.
          </p>
        </Secao>
      </aside>
    </div>
  );
}

function EditorPeca({
  peca,
  indice,
  chaves,
  tipo,
  aoMudar,
  aoRemover,
}: {
  peca: ModeloPeca;
  indice: number;
  chaves: string[];
  tipo: TipoModulo;
  aoMudar: (p: ModeloPeca) => void;
  aoRemover: () => void;
}) {
  const erros = useMemo(() => {
    const r: Partial<Record<ErroRegra['campo'], string>> = {};
    for (const e of validarTipoModulo({ ...tipo, pecas: [peca] }, chaves))
      r[e.campo] ??= e.mensagem;
    return r;
  }, [peca, tipo, chaves]);
  const id = (c: string) => `p${indice}-${c}`;
  const formula = (
    campo: 'quantidade' | 'comprimento' | 'largura' | 'condicao',
    rotulo: string,
    dica?: string,
  ) => (
    <Campo id={id(campo)} rotulo={rotulo} erro={erros[campo]} dica={dica}>
      <Input
        id={id(campo)}
        value={peca[campo] ?? ''}
        onChange={(e) => aoMudar({ ...peca, [campo]: e.target.value })}
        aria-invalid={!!erros[campo]}
        className="font-mono text-sm"
        spellCheck={false}
        autoCapitalize="off"
      />
    </Campo>
  );
  const semErros = Object.keys(erros).length === 0;

  return (
    <Secao
      titulo={peca.nome || 'Peça'}
      descricao={
        semErros ? (
          <span className="inline-flex items-center gap-1 text-success">
            <CircleCheck className="size-3.5" /> Fórmulas válidas
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-destructive">
            <CircleX className="size-3.5" /> Há erros nas fórmulas
          </span>
        )
      }
      acao={
        <Button
          variant="ghost"
          size="sm"
          onClick={aoRemover}
          aria-label={`Remover peça ${peca.nome}`}
        >
          <Trash2 /> Remover
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo id={id('nome')} rotulo="Nome">
          <Input
            id={id('nome')}
            value={peca.nome}
            onChange={(e) => aoMudar({ ...peca, nome: e.target.value })}
          />
        </Campo>
        <Campo id={id('tipo')} rotulo="Tipo de peça">
          <SelectNativo
            id={id('tipo')}
            value={peca.tipo}
            onChange={(e) => aoMudar({ ...peca, tipo: e.target.value })}
          >
            {[...new Set([...TIPOS_PECA, peca.tipo])].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </SelectNativo>
        </Campo>
        <Campo id={id('material')} rotulo="Material do módulo">
          <SelectNativo
            id={id('material')}
            value={peca.material}
            onChange={(e) =>
              aoMudar({ ...peca, material: e.target.value as ModeloPeca['material'] })
            }
          >
            <option value="caixa">Caixa</option>
            <option value="porta">Porta</option>
            <option value="fundo">Fundo</option>
          </SelectNativo>
        </Campo>
      </div>
      {/* Fórmulas costumam ser longas: cada uma ocupa a linha inteira */}
      <div className="mt-4 grid gap-4">
        {formula('comprimento', 'Comprimento', 'No sentido do veio. Na porta, a altura.')}
        {formula('largura', 'Largura')}
        <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          {formula('quantidade', 'Quantidade')}
          {formula(
            'condicao',
            'Condição (opcional)',
            'Só gera a peça se o resultado for diferente de 0. Ex.: nPortas > 0',
          )}
        </div>
      </div>
      <fieldset className="mt-4">
        <legend className="mb-2 text-sm font-medium">Fita de borda (mm, 0 = sem fita)</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {BORDAS.map((b, k) => (
            <label key={b} className="space-y-1 text-xs whitespace-nowrap text-muted-foreground">
              {b.replace('Comprimento', 'Comp.').replace('Largura', 'Larg.')}
              <Input
                inputMode="decimal"
                aria-label={`Fita ${b} de ${peca.nome}`}
                value={mmBR(peca.fita[k] ?? 0)}
                onChange={(e) => {
                  const v = Number(e.target.value.replace(',', '.'));
                  const fita = [...peca.fita] as Fitas;
                  fita[k] = Number.isFinite(v) ? v : 0;
                  aoMudar({ ...peca, fita });
                }}
                className="text-right"
              />
            </label>
          ))}
        </div>
      </fieldset>
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={peca.podeGirar ?? true}
          onChange={(e) => aoMudar({ ...peca, podeGirar: e.target.checked })}
        />
        Pode girar na chapa (o veio do material sempre prevalece)
      </label>
    </Secao>
  );
}

function Previa({ tipo, regras }: { tipo: TipoModulo; regras: ParametroRegra[] }) {
  const [m, setM] = useState({ L: '800', A: '720', P: '550', nPortas: '2' });
  const resultado = useMemo(() => {
    const n = (s: string) => Number(s.replace(',', '.')) || 0;
    return gerarPecas(
      {
        id: 'previa',
        nome: 'Prévia',
        tipoId: tipo.id,
        L: n(m.L),
        A: n(m.A),
        P: n(m.P),
        nPortas: Math.round(n(m.nPortas)),
        materiais: { caixa: 'caixa', porta: 'porta', fundo: 'fundo' },
      },
      tipo,
      valoresDe(regras),
      MATERIAIS_PREVIA,
    );
  }, [m, tipo, regras]);

  return (
    <Secao
      titulo="Prévia"
      descricao="Peças geradas para um módulo de exemplo (caixa 15 mm, fundo 6 mm)."
    >
      <div className="grid grid-cols-4 gap-2">
        {(['L', 'A', 'P', 'nPortas'] as const).map((k) => (
          <label key={k} className="space-y-1 text-xs text-muted-foreground">
            {k === 'nPortas' ? 'Portas' : k}
            <Input
              inputMode="decimal"
              aria-label={`Prévia ${k}`}
              value={m[k]}
              onChange={(e) => setM({ ...m, [k]: e.target.value })}
              className="px-2 text-right"
            />
          </label>
        ))}
      </div>
      <ul className="mt-4 space-y-2" aria-label="Peças da prévia">
        {resultado.pecas.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm"
          >
            <span>
              <span className="font-medium">
                {p.quantidade}× {p.nome}
              </span>
              <span className="block text-xs text-muted-foreground">
                {p.materialId} · {p.espessura} mm
              </span>
            </span>
            <Badge variant="outline" className="tabular-nums">
              {mmBR(p.comprimento)} × {mmBR(p.largura)}
            </Badge>
          </li>
        ))}
        {resultado.pecas.length === 0 && resultado.erros.length === 0 && (
          <li className="text-sm text-muted-foreground">Nenhuma peça para estas medidas.</li>
        )}
        {resultado.erros.map((e, i) => (
          <li key={i} className="text-xs text-destructive">
            {e.peca} ({e.campo}): {e.mensagem}
          </li>
        ))}
      </ul>
    </Secao>
  );
}
