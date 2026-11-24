'use client';

import { useRef, useState, useTransition } from 'react';
import { AlertTriangle, FileUp, Info, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from 'cn';
import { Campo, SelectNativo, useAcao } from '@/components/app/form';
import { mmBR } from '@/components/app/secao';
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
import { analisarXml, importarXml, type AnaliseXml } from './actions-importacao';
import type { MaterialVM } from './tipos';

interface NovoMaterial {
  descricao: string;
  chapaComprimento: string;
  chapaLargura: string;
  temVeio: boolean;
}
/** Para cada chave desconhecida: id de material existente, ou 'novo'. */
type Escolha = { tipo: 'existente'; id: string } | { tipo: 'novo'; dados: NovoMaterial };

export function ImportarXml({
  projetoId,
  materiais,
  reimportar,
  grande,
}: {
  projetoId: string;
  materiais: MaterialVM[];
  reimportar?: { id: string; nome: string };
  grande?: boolean;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const [lendo, iniciar] = useTransition();
  const [arquivo, setArquivo] = useState<{ nome: string; xml: string } | null>(null);
  const [analise, setAnalise] = useState<AnaliseXml | null>(null);
  const [nomeAmbiente, setNomeAmbiente] = useState('');
  const [escolhas, setEscolhas] = useState<Record<string, Escolha>>({});
  const fechar = () => {
    setAnalise(null);
    setArquivo(null);
  };
  const importacao = useAcao(importarXml, { aoConcluir: fechar });

  const abrirArquivo = (f: File | undefined) => {
    if (!f) return;
    if (!/\.xml$/i.test(f.name)) {
      toast.error('Escolha o arquivo .xml exportado do Promob.');
      return;
    }
    iniciar(async () => {
      const xml = await f.text();
      const r = await analisarXml({ projetoId, xml });
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      setArquivo({ nome: f.name, xml });
      setAnalise(r.dados);
      setNomeAmbiente(r.dados.ambientes[0]?.descricao || f.name.replace(/\.xml$/i, ''));
      setEscolhas(
        Object.fromEntries(
          r.dados.desconhecidos.map((d) => [
            d.chave,
            d.sugestaoId
              ? { tipo: 'existente', id: d.sugestaoId }
              : {
                  tipo: 'novo',
                  dados: {
                    descricao: d.descricao,
                    chapaComprimento: String(d.chapaSugerida?.comprimento ?? 2750),
                    chapaLargura: String(d.chapaSugerida?.largura ?? 1830),
                    temVeio: false,
                  },
                },
          ]),
        ),
      );
    });
    if (entrada.current) entrada.current.value = '';
  };

  const confirmar = () => {
    if (!arquivo) return;
    importacao.executar({
      projetoId,
      xml: arquivo.xml,
      nomeArquivo: arquivo.nome,
      ...(reimportar ? { ambienteId: reimportar.id } : { nomeAmbiente }),
      mapeamento: Object.fromEntries(
        Object.entries(escolhas).map(([chave, e]) => [
          chave,
          e.tipo === 'existente'
            ? e.id
            : {
                ...e.dados,
                chapaComprimento: e.dados.chapaComprimento.replace(',', '.'),
                chapaLargura: e.dados.chapaLargura.replace(',', '.'),
              },
        ]),
      ),
    });
  };

  const seletor = (
    <input
      ref={entrada}
      type="file"
      accept=".xml,text/xml,application/xml"
      className="sr-only"
      aria-label={reimportar ? `Reimportar XML de ${reimportar.nome}` : 'Escolher arquivo XML'}
      onChange={(e) => abrirArquivo(e.target.files?.[0])}
    />
  );

  return (
    <>
      {grande ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastando(false);
            abrirArquivo(e.dataTransfer.files[0]);
          }}
          className={cn(
            'flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors',
            arrastando ? 'border-primary bg-primary/5' : 'border-border bg-card',
          )}
        >
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {lendo ? <Loader2 className="size-7 animate-spin" /> : <FileUp className="size-7" />}
          </div>
          <h2 className="text-lg font-semibold">Importe o XML do Promob</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Arraste aqui o arquivo da listagem (um por ambiente: cozinha, dormitório…) ou escolha no
            computador.
          </p>
          <Button className="mt-6" onClick={() => entrada.current?.click()} disabled={lendo}>
            <Upload /> Escolher arquivo
          </Button>
          {seletor}
        </div>
      ) : (
        <>
          <Button
            variant={reimportar ? 'ghost' : 'outline'}
            size={reimportar ? 'sm' : 'default'}
            onClick={() => entrada.current?.click()}
            disabled={lendo}
          >
            {lendo ? <Loader2 className="animate-spin" /> : <Upload />}
            {reimportar ? 'Reimportar XML' : 'Importar XML'}
          </Button>
          {seletor}
        </>
      )}

      <Dialog open={!!analise} onOpenChange={(v) => !v && fechar()}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          {analise && (
            <div className="space-y-5">
              <DialogHeader>
                <DialogTitle>
                  {reimportar ? `Reimportar ${reimportar.nome}` : 'Importar ambiente'}
                </DialogTitle>
                <DialogDescription>{arquivo?.nome}</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-3 gap-3 text-center">
                <Numero rotulo="Ambientes" valor={analise.ambientes.length} />
                <Numero
                  rotulo="Linhas no XML"
                  valor={analise.ambientes.reduce((s, a) => s + a.linhas, 0)}
                />
                <Numero rotulo="Peças" valor={analise.ambientes.reduce((s, a) => s + a.pecas, 0)} />
              </div>

              {reimportar ? (
                <Aviso icone={<Info />}>
                  As peças que vieram do XML neste ambiente serão substituídas. Módulos e peças
                  avulsas continuam.
                </Aviso>
              ) : analise.ambientes.length === 1 ? (
                <Campo id="imp-nome" rotulo="Nome do ambiente">
                  <Input
                    id="imp-nome"
                    value={nomeAmbiente}
                    onChange={(e) => setNomeAmbiente(e.target.value)}
                  />
                </Campo>
              ) : (
                <Aviso icone={<Info />}>
                  Este XML tem {analise.ambientes.length} ambientes: cada um vira um ambiente do
                  projeto ({analise.ambientes.map((a) => a.descricao).join(', ')}).
                </Aviso>
              )}

              {analise.desconhecidos.length > 0 && (
                <section className="space-y-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <AlertTriangle className="size-4 text-warning" />
                    Materiais que o pro-cutter ainda não conhece
                  </h3>
                  {analise.desconhecidos.map((d) => (
                    <EscolhaMaterial
                      key={d.chave}
                      desconhecido={d}
                      materiais={materiais.filter((m) => m.ativo && m.espessura === d.espessura)}
                      escolha={escolhas[d.chave]!}
                      aoMudar={(e) => setEscolhas({ ...escolhas, [d.chave]: e })}
                    />
                  ))}
                  <p className="text-xs text-muted-foreground">
                    A escolha fica gravada no material: nas próximas importações ele é reconhecido
                    sozinho.
                  </p>
                </section>
              )}

              {analise.ignorados.map((g) => (
                <Aviso key={g.grupo} icone={<Info />}>
                  {g.itens} linha(s) do grupo “{g.grupo}” foram ignoradas: {g.tipoPeca} é gerado
                  pelo pro-cutter (Configurações › Importação).
                </Aviso>
              ))}
              {analise.naoChapa > 0 && (
                <Aviso icone={<Info />}>
                  {analise.naoChapa} item(ns) sem medida de chapa (ferragens, acessórios) não entram
                  no corte.
                </Aviso>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={fechar}>
                  Cancelar
                </Button>
                <Button onClick={confirmar} disabled={importacao.pendente}>
                  {importacao.pendente && <Loader2 className="animate-spin" />}
                  {reimportar ? 'Reimportar' : 'Importar'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="rounded-xl bg-muted/60 px-3 py-3">
      <div className="text-2xl font-semibold tabular-nums">{valor}</div>
      <div className="text-xs text-muted-foreground">{rotulo}</div>
    </div>
  );
}

function Aviso({ icone, children }: { icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="flex gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0">
      {icone}
      <span>{children}</span>
    </p>
  );
}

function EscolhaMaterial({
  desconhecido: d,
  materiais,
  escolha,
  aoMudar,
}: {
  desconhecido: AnaliseXml['desconhecidos'][number];
  materiais: MaterialVM[];
  escolha: Escolha;
  aoMudar: (e: Escolha) => void;
}) {
  const novo: NovoMaterial =
    escolha.tipo === 'novo'
      ? escolha.dados
      : {
          descricao: d.descricao,
          chapaComprimento: String(d.chapaSugerida?.comprimento ?? 2750),
          chapaLargura: String(d.chapaSugerida?.largura ?? 1830),
          temVeio: false,
        };
  const id = `mat-${d.chave.replace(/\W/g, '_')}`;

  return (
    <div className="space-y-3 rounded-xl border p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium">{d.descricao}</div>
          <code className="text-xs text-muted-foreground">{d.chave}</code>
        </div>
        <span className="text-xs whitespace-nowrap text-muted-foreground">{d.itens} linha(s)</span>
      </div>
      <SelectNativo
        id={id}
        aria-label={`Material para ${d.descricao}`}
        value={escolha.tipo === 'existente' ? escolha.id : 'novo'}
        onChange={(e) =>
          aoMudar(
            e.target.value === 'novo'
              ? { tipo: 'novo', dados: novo }
              : { tipo: 'existente', id: e.target.value },
          )
        }
      >
        {materiais.map((m) => (
          <option key={m.id} value={m.id}>
            Usar: {m.descricao}
          </option>
        ))}
        <option value="novo">Cadastrar como material novo</option>
      </SelectNativo>
      {escolha.tipo === 'novo' && (
        <div className="grid gap-3 sm:grid-cols-[1fr_6rem_6rem]">
          <Input
            aria-label={`Descrição do material novo ${d.chave}`}
            value={novo.descricao}
            onChange={(e) =>
              aoMudar({ tipo: 'novo', dados: { ...novo, descricao: e.target.value } })
            }
          />
          <Input
            inputMode="decimal"
            aria-label="Comprimento da chapa"
            value={novo.chapaComprimento}
            onChange={(e) =>
              aoMudar({ tipo: 'novo', dados: { ...novo, chapaComprimento: e.target.value } })
            }
          />
          <Input
            inputMode="decimal"
            aria-label="Largura da chapa"
            value={novo.chapaLargura}
            onChange={(e) =>
              aoMudar({ tipo: 'novo', dados: { ...novo, chapaLargura: e.target.value } })
            }
          />
          <label className="flex items-center gap-2 text-sm sm:col-span-3">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={novo.temVeio}
              onChange={(e) =>
                aoMudar({ tipo: 'novo', dados: { ...novo, temVeio: e.target.checked } })
              }
            />
            Tem veio (padrão amadeirado: as peças não giram)
          </label>
          <p className="text-xs text-muted-foreground sm:col-span-3">
            Chapa de {mmBR(Number(novo.chapaComprimento.replace(',', '.')) || 0)} ×{' '}
            {mmBR(Number(novo.chapaLargura.replace(',', '.')) || 0)} mm, {d.espessura} mm de
            espessura.
          </p>
        </div>
      )}
    </div>
  );
}
