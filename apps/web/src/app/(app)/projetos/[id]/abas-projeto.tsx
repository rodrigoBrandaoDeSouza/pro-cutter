'use client';

import { useState } from 'react';
import { Boxes, History, LayoutGrid, Scissors, SlidersHorizontal } from 'lucide-react';
import type { TipoModulo, ValoresRegras } from '@pro-cutter/regras';
import { EstadoVazio } from '@/components/app/cabecalho';
import { quando, SeloStatus } from '@/components/app/status';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Status } from '@/lib/status';
import { AbaAmbientes } from './aba-ambientes';
import { AbaPecas } from './aba-pecas';
import { AbaRegrasProjeto } from './aba-regras-projeto';
import type { AmbienteVM, MaterialVM, ModuloVM, ParametroVM, PecaVM } from './tipos';

export interface ItemHistorico {
  id: string;
  de: Status | null;
  para: Status;
  em: string;
  usuario: string;
}

const ABAS = ['ambientes', 'pecas', 'plano', 'regras', 'historico'] as const;

export function AbasProjeto(props: {
  abaInicial?: string;
  projetoId: string;
  ambientes: AmbienteVM[];
  modulos: ModuloVM[];
  pecas: PecaVM[];
  materiais: MaterialVM[];
  tipos: TipoModulo[];
  regras: ValoresRegras;
  parametros: ParametroVM[];
  historico: ItemHistorico[];
}) {
  const inicial = ABAS.find((a) => a === props.abaInicial) ?? 'ambientes';
  const [aba, setAba] = useState<string>(inicial);
  const totalPecas = props.pecas.reduce((s, p) => s + p.quantidade, 0);

  return (
    <Tabs
      value={aba}
      onValueChange={(v) => {
        // Só atualiza a URL (para recarregar na mesma aba), sem ida ao servidor
        setAba(String(v));
        window.history.replaceState(null, '', `?aba=${String(v)}`);
      }}
    >
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabsList>
          <TabsTrigger value="ambientes">
            <LayoutGrid /> Ambientes
            <Contador n={props.ambientes.length} />
          </TabsTrigger>
          <TabsTrigger value="pecas">
            <Boxes /> Peças
            <Contador n={totalPecas} />
          </TabsTrigger>
          <TabsTrigger value="plano">
            <Scissors /> Plano de corte
          </TabsTrigger>
          <TabsTrigger value="regras">
            <SlidersHorizontal /> Regras
          </TabsTrigger>
          <TabsTrigger value="historico">
            <History /> Histórico
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="ambientes" className="mt-6">
        <AbaAmbientes
          projetoId={props.projetoId}
          ambientes={props.ambientes}
          modulos={props.modulos}
          pecas={props.pecas}
          materiais={props.materiais}
          tipos={props.tipos}
          parametros={props.parametros}
          regras={props.regras}
        />
      </TabsContent>
      <TabsContent value="pecas" className="mt-6">
        <AbaPecas
          projetoId={props.projetoId}
          ambientes={props.ambientes}
          modulos={props.modulos}
          pecas={props.pecas}
          materiais={props.materiais}
        />
      </TabsContent>
      <TabsContent value="plano">
        <EstadoVazio
          icone={<Scissors />}
          titulo="Plano de corte"
          descricao="A otimização e o visualizador de chapas chegam na próxima etapa."
        />
      </TabsContent>
      <TabsContent value="regras" className="mt-6">
        <AbaRegrasProjeto
          projetoId={props.projetoId}
          regras={props.regras}
          parametros={props.parametros}
          tipos={props.tipos}
        />
      </TabsContent>
      <TabsContent value="historico" className="mt-6">
        <ol className="relative max-w-xl space-y-5 border-l pl-6" aria-label="Histórico de status">
          {props.historico.map((h) => (
            <li key={h.id} className="relative">
              <span className="absolute top-1.5 -left-[1.95rem] size-2.5 rounded-full border-2 border-background bg-primary" />
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {h.de ? (
                  <>
                    <SeloStatus status={h.de} /> <span className="text-muted-foreground">→</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Criado como</span>
                )}
                <SeloStatus status={h.para} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {h.usuario} · {quando(h.em)}
              </p>
            </li>
          ))}
        </ol>
      </TabsContent>
    </Tabs>
  );
}

function Contador({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="ml-0.5 rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
      {n}
    </span>
  );
}
