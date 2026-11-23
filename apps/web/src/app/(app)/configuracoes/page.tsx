import type { Metadata } from 'next';
import { Cabecalho } from '@/components/app/cabecalho';
import { lerConfiguracao } from '@/lib/server/config';
import { prisma } from '@/lib/server/db';
import { exigirAdmin } from '@/lib/server/sessao';
import { daEmpresa } from '@pro-cutter/db';
import { AbasConfiguracao } from './abas';

export const metadata: Metadata = { title: 'Configurações' };

export default async function PaginaConfiguracoes({ searchParams }: PageProps<'/configuracoes'>) {
  const admin = await exigirAdmin();
  const db = daEmpresa(prisma, admin.empresaId);
  const { aba } = await searchParams;

  const [cfg, materiais, fitas, maquina] = await Promise.all([
    lerConfiguracao(db),
    db.material.findMany({
      orderBy: [{ ativo: 'desc' }, { espessura: 'desc' }, { descricao: 'asc' }],
    }),
    db.fita.findMany({ orderBy: { cor: 'asc' } }),
    db.maquina.findFirstOrThrow({ where: { padrao: true } }),
  ]);

  return (
    <>
      <Cabecalho
        titulo="Configurações"
        descricao="Padrões da marcenaria. Projetos novos copiam estas regras e fórmulas."
      />
      <div className="px-4 py-6 sm:px-8">
        <AbasConfiguracao
          abaInicial={typeof aba === 'string' ? aba : 'materiais'}
          materiais={materiais.map((m) => ({
            id: m.id,
            descricao: m.descricao,
            espessura: m.espessura,
            chapaComprimento: m.chapaComprimento,
            chapaLargura: m.chapaLargura,
            temVeio: m.temVeio,
            chavesPromob: m.chavesPromob,
            textoProg: m.textoProg ?? '',
            ativo: m.ativo,
          }))}
          fitas={fitas.map((f) => ({ id: f.id, cor: f.cor, espessura: f.espessura }))}
          maquina={{
            id: maquina.id,
            nome: maquina.nome,
            serra: maquina.serra,
            refiloFabrica: maquina.refiloFabrica,
            refiloSerrado: maquina.refiloSerrado,
            niveisMax: maquina.niveisMax,
            sobraMinComp: maquina.sobraMinComp,
            sobraMinLarg: maquina.sobraMinLarg,
          }}
          regras={cfg.regras}
          tiposModulo={cfg.tiposModulo}
          importacao={cfg.importacao}
          etiqueta={cfg.etiqueta}
        />
      </div>
    </>
  );
}
