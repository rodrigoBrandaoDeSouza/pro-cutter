'use client';

import { useState } from 'react';
import { Pencil, Plus, Wheat } from 'lucide-react';
import { BotaoExcluir } from '@/components/app/confirmar';
import { Campo, useAcao } from '@/components/app/form';
import { mmBR, Secao } from '@/components/app/secao';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { excluirFita, excluirMaterial, salvarFita, salvarMaterial } from './actions';

export interface MaterialLista {
  id: string;
  descricao: string;
  espessura: number;
  chapaComprimento: number;
  chapaLargura: number;
  temVeio: boolean;
  precoChapa: number | null;
  chavesPromob: string[];
  textoProg: string;
  ativo: boolean;
}

export interface FitaLista {
  id: string;
  cor: string;
  espessura: number;
}

export function AbaMateriais({
  materiais,
  fitas,
}: {
  materiais: MaterialLista[];
  fitas: FitaLista[];
}) {
  return (
    <div className="grid gap-6">
      <Secao
        titulo="Materiais (chapas)"
        descricao="Cor, espessura e tamanho da chapa. As chaves do Promob ligam a listagem a cada material."
        acao={<DialogoMaterial />}
      >
        {materiais.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum material cadastrado.</p>
        ) : (
          <div className="-mx-5 -my-5 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Material</TableHead>
                  <TableHead>Chapa (mm)</TableHead>
                  <TableHead className="hidden md:table-cell">Chaves do Promob</TableHead>
                  <TableHead className="w-24 pr-5">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materiais.map((m) => (
                  <TableRow key={m.id} className={m.ativo ? '' : 'opacity-60'}>
                    <TableCell className="pl-5">
                      <div className="flex flex-wrap items-center gap-2 font-medium">
                        {m.descricao}
                        {m.temVeio && (
                          <Badge variant="secondary">
                            <Wheat /> Veio
                          </Badge>
                        )}
                        {!m.ativo && <Badge variant="outline">Desativado</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">{mmBR(m.espessura)} mm</div>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {mmBR(m.chapaComprimento)} × {mmBR(m.chapaLargura)}
                      <div className="text-xs text-muted-foreground">
                        {m.precoChapa == null
                          ? 'sem preço'
                          : m.precoChapa.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {m.chavesPromob.length ? (
                          m.chavesPromob.map((c) => (
                            <code key={c} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                              {c}
                            </code>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="pr-5">
                      <div className="flex justify-end gap-1">
                        <DialogoMaterial material={m} />
                        <BotaoExcluir
                          rotulo={`Excluir ${m.descricao}`}
                          titulo={`Excluir ${m.descricao}?`}
                          descricao="Se o material já estiver em algum projeto, ele será só desativado."
                          acao={() => excluirMaterial(m.id)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Secao>

      <Secao
        titulo="Fitas de borda"
        descricao="Cores e espessuras usadas no relatório de material."
        acao={<DialogoFita />}
      >
        {fitas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma fita cadastrada.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {fitas.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-1 rounded-lg border py-1 pr-1 pl-3 text-sm"
              >
                {f.cor} · {mmBR(f.espessura)} mm
                <DialogoFita fita={f} />
                <BotaoExcluir
                  rotulo={`Excluir fita ${f.cor}`}
                  titulo={`Excluir a fita ${f.cor}?`}
                  acao={() => excluirFita(f.id)}
                  tamanho="icon-sm"
                />
              </li>
            ))}
          </ul>
        )}
      </Secao>
    </div>
  );
}

/** "1.289,90" ou "289.9" → número em texto; vazio → null. Com vírgula, os pontos são milhar. */
function lerPreco(s: string): string | null {
  const t = s.replace(/R\$|\s/g, '');
  if (!t) return null;
  return t.includes(',') ? t.replaceAll('.', '').replace(',', '.') : t;
}

function DialogoMaterial({ material }: { material?: MaterialLista }) {
  const vazio = {
    descricao: '',
    espessura: '15',
    chapaComprimento: '2750',
    chapaLargura: '1830',
    temVeio: false,
    preco: '',
    chaves: '',
    textoProg: '',
    ativo: true,
  };
  const [aberto, setAberto] = useState(false);
  const [f, setF] = useState(vazio);
  const { executar, pendente, erros, limparErros } = useAcao(salvarMaterial, {
    aoConcluir: () => setAberto(false),
  });

  const abrir = (v: boolean) => {
    setAberto(v);
    if (!v) return;
    limparErros();
    setF(
      material
        ? {
            descricao: material.descricao,
            espessura: String(material.espessura),
            chapaComprimento: String(material.chapaComprimento),
            chapaLargura: String(material.chapaLargura),
            temVeio: material.temVeio,
            preco: material.precoChapa == null ? '' : String(material.precoChapa).replace('.', ','),
            chaves: material.chavesPromob.join('\n'),
            textoProg: material.textoProg,
            ativo: material.ativo,
          }
        : vazio,
    );
  };

  const num = (s: string) => s.replace(',', '.');

  return (
    <Dialog open={aberto} onOpenChange={abrir}>
      <DialogTrigger
        render={
          material ? (
            <Button variant="ghost" size="icon" aria-label={`Editar ${material.descricao}`} />
          ) : (
            <Button />
          )
        }
      >
        {material ? (
          <Pencil />
        ) : (
          <>
            <Plus /> Novo material
          </>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            executar({
              id: material?.id,
              descricao: f.descricao,
              espessura: num(f.espessura),
              chapaComprimento: num(f.chapaComprimento),
              chapaLargura: num(f.chapaLargura),
              temVeio: f.temVeio,
              precoChapa: lerPreco(f.preco),
              chavesPromob: f.chaves
                .split(/\n|;/)
                .map((s) => s.trim())
                .filter(Boolean),
              textoProg: f.textoProg,
              ativo: f.ativo,
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{material ? 'Editar material' : 'Novo material'}</DialogTitle>
            <DialogDescription>Uma combinação de cor e espessura de chapa.</DialogDescription>
          </DialogHeader>

          <Campo id="m-desc" rotulo="Descrição" erro={erros.descricao}>
            <Input
              id="m-desc"
              placeholder="MDF Branco 15mm"
              value={f.descricao}
              onChange={(e) => setF({ ...f, descricao: e.target.value })}
              aria-invalid={!!erros.descricao}
              autoFocus
            />
          </Campo>
          <div className="grid grid-cols-3 gap-3">
            <Campo id="m-esp" rotulo="Espessura" erro={erros.espessura}>
              <Input
                id="m-esp"
                inputMode="decimal"
                value={f.espessura}
                onChange={(e) => setF({ ...f, espessura: e.target.value })}
                aria-invalid={!!erros.espessura}
              />
            </Campo>
            <Campo id="m-comp" rotulo="Comprimento" erro={erros.chapaComprimento}>
              <Input
                id="m-comp"
                inputMode="decimal"
                value={f.chapaComprimento}
                onChange={(e) => setF({ ...f, chapaComprimento: e.target.value })}
                aria-invalid={!!erros.chapaComprimento}
              />
            </Campo>
            <Campo id="m-larg" rotulo="Largura" erro={erros.chapaLargura}>
              <Input
                id="m-larg"
                inputMode="decimal"
                value={f.chapaLargura}
                onChange={(e) => setF({ ...f, chapaLargura: e.target.value })}
                aria-invalid={!!erros.chapaLargura}
              />
            </Campo>
          </div>
          <Campo
            id="m-preco"
            rotulo="Preço da chapa (R$, opcional)"
            erro={erros.precoChapa}
            dica="Preço de uma chapa inteira. Usado no Painel para custo, desperdício e economia."
          >
            <Input
              id="m-preco"
              inputMode="decimal"
              placeholder="Ex.: 289,90"
              value={f.preco}
              onChange={(e) => setF({ ...f, preco: e.target.value })}
              aria-invalid={!!erros.precoChapa}
              className="tabular-nums"
            />
          </Campo>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              checked={f.temVeio}
              onChange={(e) => setF({ ...f, temVeio: e.target.checked })}
            />
            <span>
              Tem veio
              <span className="block text-xs text-muted-foreground">
                As peças não giram; o veio acompanha o comprimento da chapa.
              </span>
            </span>
          </label>
          <Campo
            id="m-chaves"
            rotulo="Chaves do Promob"
            erro={erros.chavesPromob}
            dica="Uma por linha, no formato modelo|espessura (ex.: Branco|15). A importação sugere quando faltar."
          >
            <textarea
              id="m-chaves"
              rows={2}
              value={f.chaves}
              onChange={(e) => setF({ ...f, chaves: e.target.value })}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
          </Campo>
          <Campo
            id="m-prog"
            rotulo="Texto no .prog da CVL"
            dica="Opcional. Em branco, usa MDF-espessura-descrição."
          >
            <Input
              id="m-prog"
              value={f.textoProg}
              onChange={(e) => setF({ ...f, textoProg: e.target.value })}
              className="font-mono text-xs"
            />
          </Campo>
          {material && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={f.ativo}
                onChange={(e) => setF({ ...f, ativo: e.target.checked })}
              />
              Ativo (aparece para novos projetos)
            </label>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pendente}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DialogoFita({ fita }: { fita?: FitaLista }) {
  const [aberto, setAberto] = useState(false);
  const [cor, setCor] = useState('');
  const [esp, setEsp] = useState('0,45');
  const { executar, pendente, erros, limparErros } = useAcao(salvarFita, {
    aoConcluir: () => setAberto(false),
  });
  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        if (v) {
          limparErros();
          setCor(fita?.cor ?? '');
          setEsp(fita ? mmBR(fita.espessura) : '0,45');
        }
      }}
    >
      <DialogTrigger
        render={
          fita ? (
            <Button variant="ghost" size="icon-sm" aria-label={`Editar fita ${fita.cor}`} />
          ) : (
            <Button variant="outline" />
          )
        }
      >
        {fita ? (
          <Pencil />
        ) : (
          <>
            <Plus /> Nova fita
          </>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            executar({ id: fita?.id, cor, espessura: esp.replace(',', '.') });
          }}
        >
          <DialogHeader>
            <DialogTitle>{fita ? 'Editar fita' : 'Nova fita'}</DialogTitle>
          </DialogHeader>
          <Campo id="f-cor" rotulo="Cor" erro={erros.cor}>
            <Input id="f-cor" value={cor} onChange={(e) => setCor(e.target.value)} autoFocus />
          </Campo>
          <Campo id="f-esp" rotulo="Espessura (mm)" erro={erros.espessura}>
            <Input
              id="f-esp"
              inputMode="decimal"
              value={esp}
              onChange={(e) => setEsp(e.target.value)}
            />
          </Campo>
          <DialogFooter>
            <Button type="submit" disabled={pendente}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
