'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CircleCheck,
  CircleHelp,
  CircleX,
  Copy,
  MousePointerClick,
  Plus,
  Trash2,
} from 'lucide-react';
import { cn } from 'cn';
import type { Fitas, Material } from '@pro-cutter/core';
import {
  compilar,
  DESCRICAO_VARIAVEIS,
  gerarPecas,
  validarTipoModulo,
  valoresDe,
  variaveisDoModulo,
  VARIAVEIS_DO_MODULO,
  type ErroRegra,
  type ModeloPeca,
  type Modulo,
  type ParametroRegra,
  type TipoModulo,
  type ValoresRegras,
} from '@pro-cutter/regras';
import { Campo, SelectNativo, useAcao } from '@/components/app/form';
import { mmBR, Secao } from '@/components/app/secao';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BORDAS } from '@/lib/bordas';
import { salvarTiposModulo } from './actions';

const TIPOS_PECA = ['porta', 'fundo', 'prateleira', 'frente', 'outro'];

type CampoFormula = 'quantidade' | 'comprimento' | 'largura' | 'condicao';

const NOME_CAMPO: Record<CampoFormula, string> = {
  quantidade: 'Quantidade',
  comprimento: 'Comprimento',
  largura: 'Largura',
  condicao: 'Condição',
};

/** Materiais fictícios do exemplo: caixa 15 mm, porta 15 mm com veio, fundo 6 mm. */
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
    .replace(/\p{Diacritic}/gu, '')
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
  aoIrParaRegras,
}: {
  tipos: TipoModulo[];
  regras: ParametroRegra[];
  aoIrParaRegras: () => void;
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
    <div className="space-y-6">
      <Ajuda regras={regras} aoIrParaRegras={aoIrParaRegras} />

      <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Tipos de módulo" className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm font-medium">Tipo de módulo:</span>
          {tipos.map((t, i) => (
            <button
              key={t.id + i}
              type="button"
              onClick={() => setSel(i)}
              aria-current={i === sel ? 'true' : undefined}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors',
                i === sel
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-muted',
              )}
            >
              {t.nome}
              {errosPorTipo[i] ? <CircleX className="size-3.5" aria-label="com erros" /> : null}
            </button>
          ))}
          <Button variant="ghost" size="sm" onClick={() => novoTipo()}>
            <Plus /> Novo tipo
          </Button>
        </nav>
        <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
          <Button disabled={pendente || totalErros > 0} onClick={() => executar(tipos)}>
            Salvar fórmulas
          </Button>
          <p className="text-xs text-muted-foreground">
            {totalErros > 0
              ? `Corrija ${totalErros} erro(s) antes de salvar.`
              : 'Valem para os próximos projetos.'}
          </p>
        </div>
      </div>

      {tipo ? (
        <EditorTipo
          key={sel}
          tipo={tipo}
          regras={regras}
          chaves={chaves}
          aoMudar={atualizar}
          aoDuplicar={() => novoTipo(tipo)}
          aoIrParaRegras={aoIrParaRegras}
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

const CHAVE_AJUDA = 'pro-cutter:ajuda-formulas-fechada';

/** Explicação para quem nunca mexeu: o que é um tipo, de onde vêm as folgas e a sintaxe. */
function Ajuda({
  regras,
  aoIrParaRegras,
}: {
  regras: ParametroRegra[];
  aoIrParaRegras: () => void;
}) {
  const [aberta, setAberta] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem(CHAVE_AJUDA) === '1') setAberta(false);
    } catch {
      // sem armazenamento: fica aberta
    }
  }, []);
  const v = valoresDe(regras);
  const ext = v.portaFolgaExt ?? 2;
  const entre = v.portaFolgaEntre ?? 3;
  const largura = (800 - 2 * ext - entre) / 2;

  return (
    <details
      open={aberta}
      onToggle={(e) => {
        const aberto = (e.currentTarget as HTMLDetailsElement).open;
        setAberta(aberto);
        try {
          localStorage.setItem(CHAVE_AJUDA, aberto ? '0' : '1');
        } catch {
          // ignora
        }
      }}
      className="group rounded-xl border border-primary/30 bg-primary/5"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 font-semibold">
        <CircleHelp className="size-4 text-primary" />
        Como funcionam as fórmulas
        <span className="ml-auto text-xs font-normal text-muted-foreground group-open:hidden">
          mostrar
        </span>
        <span className="ml-auto hidden text-xs font-normal text-muted-foreground group-open:inline">
          esconder
        </span>
      </summary>
      <div className="grid gap-6 px-5 pb-5 text-sm lg:grid-cols-2">
        <ol className="list-decimal space-y-2 pl-5 marker:font-semibold marker:text-primary">
          <li>
            O Promob manda as peças da caixa. As <strong>portas e fundos</strong> que ele não manda
            são calculados aqui, por <strong>tipo de módulo</strong> (Balcão, Aéreo…).
          </li>
          <li>
            No projeto, você cadastra cada módulo com as medidas (<code>L</code>, <code>A</code>,{' '}
            <code>P</code>), o número de portas e o tipo. O pro-cutter aplica as fórmulas do tipo e
            gera as peças.
          </li>
          <li>Cada fórmula é uma conta, como no Excel, usando as medidas do módulo e as folgas.</li>
          <li>
            <strong>As folgas não ficam escritas nas fórmulas.</strong> Elas são variáveis cujo
            valor vem da aba{' '}
            <button
              type="button"
              onClick={aoIrParaRegras}
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Folgas e regras
            </button>
            . Mude o valor lá e todas as fórmulas passam a usar o novo.
          </li>
        </ol>
        <div className="space-y-4">
          <div className="rounded-lg border bg-background p-3">
            <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Exemplo: largura da porta
            </p>
            <p className="font-mono text-xs">
              (L - 2*portaFolgaExt - (nPortas - 1)*portaFolgaEntre) / nPortas
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Balcão de 800 mm com 2 portas: (800 − 2×{mmBR(ext)} − 1×{mmBR(entre)}) ÷ 2 ={' '}
              <strong className="text-foreground">{mmBR(largura)} mm</strong> cada porta.
            </p>
          </div>
          <table className="w-full text-xs">
            <tbody className="[&_td]:py-1 [&_td:first-child]:pr-3 [&_td:first-child]:font-mono [&_td:first-child]:whitespace-nowrap [&_tr]:border-b [&_tr:last-child]:border-0">
              <tr>
                <td>+ - * /</td>
                <td>somar, subtrair, multiplicar, dividir</td>
              </tr>
              <tr>
                <td>( )</td>
                <td>agrupar uma parte da conta</td>
              </tr>
              <tr>
                <td>2,5</td>
                <td>números com vírgula</td>
              </tr>
              <tr>
                <td>min(a; b) max(a; b)</td>
                <td>o menor / o maior valor (use ; entre os valores)</td>
              </tr>
              <tr>
                <td>arred(x) piso(x) teto(x)</td>
                <td>arredondar, para baixo, para cima</td>
              </tr>
              <tr>
                <td>se(cond; sim; não)</td>
                <td>
                  escolhe um valor. Ex.: <code>se(nPortas &gt; 2; 3; 2)</code>
                </td>
              </tr>
              <tr>
                <td>&gt; &lt; &gt;= &lt;= = &lt;&gt;</td>
                <td>comparações (verdadeiro = 1, falso = 0)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}

interface Foco {
  el: HTMLInputElement | HTMLTextAreaElement;
  indice: number;
  campo: CampoFormula;
}

function EditorTipo({
  tipo,
  regras,
  chaves,
  aoMudar,
  aoDuplicar,
  aoExcluir,
  aoIrParaRegras,
}: {
  tipo: TipoModulo;
  regras: ParametroRegra[];
  chaves: string[];
  aoMudar: (t: TipoModulo) => void;
  aoDuplicar: () => void;
  aoExcluir?: () => void;
  aoIrParaRegras: () => void;
}) {
  const [exemplo, setExemplo] = useState({ L: '800', A: '720', P: '550', nPortas: '2' });
  const foco = useRef<Foco | null>(null);
  const [alvo, setAlvo] = useState<string>();

  const modulo = useMemo((): Modulo => {
    const n = (s: string) => Number(s.replace(',', '.')) || 0;
    return {
      id: 'exemplo',
      nome: 'Exemplo',
      tipoId: tipo.id,
      L: n(exemplo.L),
      A: n(exemplo.A),
      P: n(exemplo.P),
      nPortas: Math.round(n(exemplo.nPortas)),
      materiais: { caixa: 'caixa', porta: 'porta', fundo: 'fundo' },
    };
  }, [exemplo, tipo.id]);
  const valores = useMemo(() => valoresDe(regras), [regras]);
  const vars = useMemo(
    () => variaveisDoModulo(modulo, tipo, valores, MATERIAIS_PREVIA),
    [modulo, tipo, valores],
  );
  const resultado = useMemo(
    () => gerarPecas(modulo, tipo, valores, MATERIAIS_PREVIA),
    [modulo, tipo, valores],
  );

  const mudarPeca = (i: number, p: ModeloPeca) =>
    aoMudar({ ...tipo, pecas: tipo.pecas.map((x, k) => (k === i ? p : x)) });

  const aoFocar = (f: Foco) => {
    foco.current = f;
    setAlvo(`${tipo.pecas[f.indice]?.nome ?? 'Peça'} › ${NOME_CAMPO[f.campo]}`);
  };

  /** Insere a variável onde está o cursor da última fórmula em que a pessoa clicou. */
  const inserir = (texto: string) => {
    const f = foco.current;
    if (!f || !f.el.isConnected || !tipo.pecas[f.indice]) return;
    const ini = f.el.selectionStart ?? f.el.value.length;
    const fim = f.el.selectionEnd ?? ini;
    const novo = f.el.value.slice(0, ini) + texto + f.el.value.slice(fim);
    mudarPeca(f.indice, { ...tipo.pecas[f.indice]!, [f.campo]: novo });
    requestAnimationFrame(() => {
      f.el.focus();
      f.el.setSelectionRange(ini + texto.length, ini + texto.length);
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-6">
        <Secao
          titulo={tipo.nome || 'Sem nome'}
          descricao={`${tipo.pecas.length} peça(s) geradas por módulo deste tipo`}
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
            vars={vars}
            aoFocar={aoFocar}
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

      <aside className="min-w-0 space-y-6 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto">
        <Previa exemplo={exemplo} aoMudar={setExemplo} resultado={resultado} />
        <Variaveis
          tipo={tipo}
          regras={regras}
          vars={vars}
          alvo={alvo}
          aoInserir={inserir}
          aoIrParaRegras={aoIrParaRegras}
        />
      </aside>
    </div>
  );
}

/** Resultado da fórmula no módulo de exemplo, para a pessoa conferir a conta enquanto digita. */
function avaliarNoExemplo(texto: string, vars: ValoresRegras): number | undefined {
  try {
    const v = compilar(texto).avaliar(vars);
    return Number.isFinite(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

function EditorPeca({
  peca,
  indice,
  chaves,
  tipo,
  vars,
  aoFocar,
  aoMudar,
  aoRemover,
}: {
  peca: ModeloPeca;
  indice: number;
  chaves: string[];
  tipo: TipoModulo;
  vars: ValoresRegras;
  aoFocar: (f: Foco) => void;
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

  const formula = (campo: CampoFormula, rotulo: string, dica?: string) => {
    const texto = peca[campo] ?? '';
    const v = erros[campo] || !texto.trim() ? undefined : avaliarNoExemplo(texto, vars);
    let noExemplo: string | undefined;
    if (v !== undefined) {
      if (campo === 'condicao') noExemplo = v !== 0 ? 'sim, gera a peça' : 'não gera a peça';
      else if (campo === 'quantidade') noExemplo = `${mmBR(Math.round(v))} peça(s)`;
      else noExemplo = `${mmBR(Math.round(v * 10) / 10)} mm`;
    }
    const erro = erros[campo];
    return (
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <Label htmlFor={id(campo)}>{rotulo}</Label>
          {noExemplo && (
            <span
              className="rounded bg-success/10 px-1.5 py-0.5 text-xs font-medium text-success tabular-nums"
              title="Resultado no módulo de exemplo"
            >
              = {noExemplo}
            </span>
          )}
        </div>
        {/* Textarea que cresce: fórmula longa quebra a linha em vez de sumir */}
        <Textarea
          id={id(campo)}
          rows={1}
          value={texto}
          onFocus={(e) => aoFocar({ el: e.currentTarget, indice, campo })}
          onChange={(e) => aoMudar({ ...peca, [campo]: e.target.value.replace(/\s*\n\s*/g, ' ') })}
          onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
          aria-invalid={!!erro}
          className="min-h-9 resize-none py-1.5 font-mono text-sm"
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
        />
        {erro ? (
          <p id={`${id(campo)}-erro`} className="text-xs text-destructive">
            {erro}
          </p>
        ) : (
          dica && <p className="text-xs text-muted-foreground">{dica}</p>
        )}
      </div>
    );
  };
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
      <div className="grid gap-4 md:grid-cols-3">
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
        <Campo id={id('material')} rotulo="Chapa usada" dica="Escolhida em cada módulo do projeto.">
          <SelectNativo
            id={id('material')}
            value={peca.material}
            onChange={(e) =>
              aoMudar({ ...peca, material: e.target.value as ModeloPeca['material'] })
            }
          >
            <option value="caixa">Chapa da caixa</option>
            <option value="porta">Chapa da porta</option>
            <option value="fundo">Chapa do fundo</option>
          </SelectNativo>
        </Campo>
      </div>

      <div className="mt-5 space-y-4 border-t pt-5">
        {formula('comprimento', 'Comprimento', 'Medida no sentido do veio. Na porta, é a altura.')}
        {formula('largura', 'Largura', 'A outra medida. Na porta, é a largura.')}
        <div className="grid gap-4 md:grid-cols-[12rem_minmax(0,1fr)]">
          {formula('quantidade', 'Quantidade', 'Quantas peças iguais.')}
          {formula(
            'condicao',
            'Só gerar quando (opcional)',
            'Deixe vazio para sempre gerar. Ex.: nPortas > 0',
          )}
        </div>
      </div>

      <fieldset className="mt-5 border-t pt-5">
        <legend className="sr-only">Fita de borda</legend>
        <p className="mb-1 text-sm font-medium">Fita de borda</p>
        <p className="mb-3 text-xs text-muted-foreground">
          Espessura da fita em cada lado, em mm. Use 0 para o lado sem fita.
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {BORDAS.map((b, k) => (
            <label key={b} className="flex flex-col gap-1 text-xs text-muted-foreground">
              {b}
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
                className="text-right tabular-nums"
              />
            </label>
          ))}
        </div>
      </fieldset>
      <label className="mt-5 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-primary"
          checked={peca.podeGirar ?? true}
          onChange={(e) => aoMudar({ ...peca, podeGirar: e.target.checked })}
        />
        <span>
          Pode girar na chapa
          <span className="block text-xs text-muted-foreground">
            Se a chapa tiver veio, o veio sempre prevalece.
          </span>
        </span>
      </label>
    </Secao>
  );
}

function Previa({
  exemplo,
  aoMudar,
  resultado,
}: {
  exemplo: { L: string; A: string; P: string; nPortas: string };
  aoMudar: (e: { L: string; A: string; P: string; nPortas: string }) => void;
  resultado: ReturnType<typeof gerarPecas>;
}) {
  return (
    <Secao
      titulo="Módulo de exemplo"
      descricao="Mude as medidas para testar. Os valores em verde ao lado de cada fórmula são calculados com este módulo (caixa 15 mm, fundo 6 mm)."
    >
      <div className="grid grid-cols-4 gap-2">
        {(['L', 'A', 'P', 'nPortas'] as const).map((k) => (
          <label key={k} className="flex flex-col gap-1 text-xs text-muted-foreground">
            {k === 'nPortas' ? 'Portas' : k}
            <Input
              inputMode="decimal"
              aria-label={`Prévia ${k}`}
              value={exemplo[k]}
              onChange={(e) => aoMudar({ ...exemplo, [k]: e.target.value })}
              className="px-2 text-right tabular-nums"
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
            <span className="min-w-0">
              <span className="font-medium">
                {p.quantidade}× {p.nome}
              </span>
              <span className="block text-xs text-muted-foreground">
                {p.materialId} · {p.espessura} mm
              </span>
            </span>
            <Badge variant="outline" className="shrink-0 tabular-nums">
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

function Variaveis({
  tipo,
  regras,
  vars,
  alvo,
  aoInserir,
  aoIrParaRegras,
}: {
  tipo: TipoModulo;
  regras: ParametroRegra[];
  vars: ValoresRegras;
  alvo?: string;
  aoInserir: (texto: string) => void;
  aoIrParaRegras: () => void;
}) {
  const linha = (chave: string, descricao: string, unidade = 'mm') => (
    <li key={chave}>
      <button
        type="button"
        // mantém o cursor na fórmula
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => aoInserir(chave)}
        disabled={!alvo}
        title={alvo ? `Inserir ${chave} em ${alvo}` : 'Clique antes numa fórmula'}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors enabled:hover:bg-muted disabled:cursor-default"
      >
        <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{chave}</code>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{descricao}</span>
        <span className="shrink-0 text-xs tabular-nums">
          {vars[chave] !== undefined ? `${mmBR(vars[chave])}${unidade ? ` ${unidade}` : ''}` : ''}
        </span>
      </button>
    </li>
  );

  return (
    <Secao titulo="Variáveis" descricao="O que pode ser usado nas fórmulas.">
      <p
        className={cn(
          'mb-4 flex items-start gap-2 rounded-lg px-3 py-2 text-xs',
          alvo ? 'bg-primary/10 text-foreground' : 'bg-muted text-muted-foreground',
        )}
      >
        <MousePointerClick className="mt-px size-3.5 shrink-0" />
        {alvo ? (
          <span>
            Clique numa variável para inserir em <strong>{alvo}</strong>.
          </span>
        ) : (
          <span>Clique numa fórmula e depois numa variável para inseri-la.</span>
        )}
      </p>

      <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Medidas do módulo
      </h3>
      <ul className="mb-4">
        {VARIAVEIS_DO_MODULO.map((v) =>
          linha(v, DESCRICAO_VARIAVEIS[v], v === 'nPortas' ? '' : 'mm'),
        )}
      </ul>

      {(tipo.extras ?? []).length > 0 && (
        <>
          <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Deste tipo
          </h3>
          <ul className="mb-4">{tipo.extras!.map((e) => linha(e.chave, e.rotulo, ''))}</ul>
        </>
      )}

      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Folgas e regras
        </h3>
        <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={aoIrParaRegras}>
          Alterar valores <ArrowRight />
        </Button>
      </div>
      <ul>{regras.map((r) => linha(r.chave, r.rotulo, r.unidade ?? ''))}</ul>
    </Secao>
  );
}
