'use client';

import { usePathname, useRouter } from 'next/navigation';
import type { ParametroRegra, TipoModulo } from '@pro-cutter/regras';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AbaFormulas } from './aba-formulas';
import { AbaImportacao, type ImportacaoForm } from './aba-importacao';
import { AbaMaquina, type MaquinaForm } from './aba-maquina';
import { AbaMateriais, type FitaLista, type MaterialLista } from './aba-materiais';
import { AbaRegras } from './aba-regras';

const ABAS = [
  ['materiais', 'Materiais'],
  ['maquina', 'Máquina'],
  ['regras', 'Regras'],
  ['formulas', 'Fórmulas'],
  ['importacao', 'Importação e etiqueta'],
] as const;

export function AbasConfiguracao(props: {
  abaInicial: string;
  materiais: MaterialLista[];
  fitas: FitaLista[];
  maquina: MaquinaForm;
  regras: ParametroRegra[];
  tiposModulo: TipoModulo[];
  importacao: ImportacaoForm;
  etiqueta: { largura: number; altura: number };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const inicial = ABAS.some(([v]) => v === props.abaInicial) ? props.abaInicial : 'materiais';

  return (
    <Tabs
      defaultValue={inicial}
      onValueChange={(v) => router.replace(`${pathname}?aba=${String(v)}`, { scroll: false })}
    >
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabsList>
          {ABAS.map(([valor, rotulo]) => (
            <TabsTrigger key={valor} value={valor}>
              {rotulo}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <TabsContent value="materiais" className="mt-6">
        <AbaMateriais materiais={props.materiais} fitas={props.fitas} />
      </TabsContent>
      <TabsContent value="maquina" className="mt-6">
        <AbaMaquina maquina={props.maquina} />
      </TabsContent>
      <TabsContent value="regras" className="mt-6">
        <AbaRegras regras={props.regras} />
      </TabsContent>
      <TabsContent value="formulas" className="mt-6">
        <AbaFormulas tipos={props.tiposModulo} regras={props.regras} />
      </TabsContent>
      <TabsContent value="importacao" className="mt-6">
        <AbaImportacao importacao={props.importacao} etiqueta={props.etiqueta} />
      </TabsContent>
    </Tabs>
  );
}
