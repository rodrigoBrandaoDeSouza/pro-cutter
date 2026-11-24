'use client';

import { useState } from 'react';
import { Campo, SelectNativo, useAcao } from '@/components/app/form';
import { mmBR, Secao } from '@/components/app/secao';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { salvarMaquina } from './actions';

export interface MaquinaForm {
  id: string;
  nome: string;
  serra: number;
  refiloFabrica: number;
  refiloSerrado: number;
  niveisMax: number;
  sobraMinComp: number;
  sobraMinLarg: number;
}

type CampoNumero = Exclude<keyof MaquinaForm, 'id' | 'nome' | 'niveisMax'>;

const CAMPOS: { chave: CampoNumero; rotulo: string; dica: string }[] = [
  { chave: 'serra', rotulo: 'Espessura da serra', dica: 'Quanto a lâmina consome em cada corte.' },
  {
    chave: 'refiloFabrica',
    rotulo: 'Refilo na borda de fábrica',
    dica: 'Aparo da borda original da chapa (amostras da CVL: 5 mm).',
  },
  {
    chave: 'refiloSerrado',
    rotulo: 'Refilo na borda já serrada',
    dica: 'Re-esquadrejamento entre níveis (amostras: 1 mm).',
  },
  {
    chave: 'sobraMinComp',
    rotulo: 'Sobra útil: comprimento mínimo',
    dica: 'Abaixo disso é perda.',
  },
  { chave: 'sobraMinLarg', rotulo: 'Sobra útil: largura mínima', dica: 'Abaixo disso é perda.' },
];

export function AbaMaquina({ maquina }: { maquina: MaquinaForm }) {
  const [f, setF] = useState<Record<string, string>>(() => ({
    nome: maquina.nome,
    niveisMax: String(maquina.niveisMax),
    ...Object.fromEntries(CAMPOS.map((c) => [c.chave, mmBR(maquina[c.chave])])),
  }));
  const { executar, pendente, erros } = useAcao(salvarMaquina);

  return (
    <Secao
      titulo="Seccionadora"
      descricao="Parâmetros usados pelo otimizador e na geração dos arquivos .prog da CVL Máxima."
    >
      <form
        className="grid max-w-3xl gap-5 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const n = (k: CampoNumero) => (f[k] ?? '').replace(',', '.');
          executar({
            id: maquina.id,
            nome: f.nome ?? '',
            niveisMax: f.niveisMax ?? '3',
            serra: n('serra'),
            refiloFabrica: n('refiloFabrica'),
            refiloSerrado: n('refiloSerrado'),
            sobraMinComp: n('sobraMinComp'),
            sobraMinLarg: n('sobraMinLarg'),
          });
        }}
      >
        <Campo id="q-nome" rotulo="Nome" erro={erros.nome} className="sm:col-span-2">
          <Input
            id="q-nome"
            value={f.nome}
            onChange={(e) => setF({ ...f, nome: e.target.value })}
          />
        </Campo>
        {CAMPOS.map((c) => (
          <Campo
            key={c.chave}
            id={`q-${c.chave}`}
            rotulo={`${c.rotulo} (mm)`}
            erro={erros[c.chave]}
            dica={c.dica}
          >
            <Input
              id={`q-${c.chave}`}
              inputMode="decimal"
              value={f[c.chave]}
              onChange={(e) => setF({ ...f, [c.chave]: e.target.value })}
              aria-invalid={!!erros[c.chave]}
            />
          </Campo>
        ))}
        <Campo
          id="q-niveis"
          rotulo="Níveis de corte"
          dica="Até 3X é o que as amostras da CVL usam (1X→1Y→2X→2Y→3X)."
        >
          <SelectNativo
            id="q-niveis"
            value={f.niveisMax}
            onChange={(e) => setF({ ...f, niveisMax: e.target.value })}
          >
            <option value="2">2 níveis (até 2X)</option>
            <option value="3">3 níveis (até 3X)</option>
          </SelectNativo>
        </Campo>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pendente}>
            Salvar máquina
          </Button>
        </div>
      </form>
    </Secao>
  );
}
