import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Phone } from 'lucide-react';
import type { TipoModulo, ValoresRegras } from '@pro-cutter/regras';
import { quando } from '@/components/app/status';
import { lerConfiguracao } from '@/lib/server/config';
import { dbDoUsuario } from '@/lib/server/sessao';
import { formatarTelefone } from '@/lib/telefone';
import { AbasProjeto, AcoesProjeto, MenuStatus } from './projeto-cliente';
import type { PlanoVM } from './aba-plano';
import type { PecaVM } from './tipos';

export async function generateMetadata({ params }: PageProps<'/projetos/[id]'>): Promise<Metadata> {
  const { db } = await dbDoUsuario();
  const p = await db.projeto.findUnique({
    where: { id: (await params).id },
    select: { nome: true },
  });
  return { title: p?.nome ?? 'Projeto' };
}

export default async function PaginaProjeto({ params, searchParams }: PageProps<'/projetos/[id]'>) {
  const { usuario, db } = await dbDoUsuario();
  const { id } = await params;
  const { aba } = await searchParams;
  const projeto = await db.projeto.findUnique({
    where: { id },
    include: {
      cliente: true,
      historico: { orderBy: { em: 'desc' }, take: 50 },
      ambientes: { orderBy: { ordem: 'asc' }, include: { modulos: { orderBy: { ordem: 'asc' } } } },
      planos: { orderBy: { versao: 'desc' }, take: 1 },
    },
  });
  if (!projeto) notFound();

  const [clientes, usuarios, pecas, materiais, cfg] = await Promise.all([
    db.cliente.findMany({ orderBy: { nome: 'asc' }, select: { id: true, nome: true } }),
    db.usuario.findMany({ select: { id: true, nome: true } }),
    db.peca.findMany({
      where: { ambiente: { projetoId: id } },
      orderBy: [{ ambienteId: 'asc' }, { moduloId: 'asc' }, { ordem: 'asc' }],
    }),
    db.material.findMany({ orderBy: [{ espessura: 'desc' }, { descricao: 'asc' }] }),
    lerConfiguracao(db),
  ]);
  const nomeUsuario = new Map(usuarios.map((u) => [u.id, u.nome]));
  const regrasProjeto = projeto.regras as unknown as ValoresRegras;
  const padroes = new Map(cfg.regras.map((r) => [r.chave, r]));
  const ultimo = projeto.planos[0];
  const plano: PlanoVM | null = ultimo
    ? {
        id: ultimo.id,
        versao: ultimo.versao,
        status: ultimo.status,
        criadoEm: ultimo.criadoEm.toISOString(),
        criadoPor: nomeUsuario.get(ultimo.criadoPorId) ?? 'usuário removido',
        parametros: ultimo.parametros as unknown as PlanoVM['parametros'],
        chapas: ultimo.chapas as unknown as PlanoVM['chapas'],
        pecas: ultimo.pecas as unknown as PlanoVM['pecas'],
        materiais: ultimo.materiais as unknown as PlanoVM['materiais'],
      }
    : null;

  return (
    <>
      <div className="border-b px-4 pt-4 pb-6 sm:px-8">
        <Link
          href="/projetos"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Projetos
        </Link>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">{projeto.nome}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{projeto.cliente.nome}</span>
              {projeto.cliente.telefone && (
                <a
                  href={`tel:+55${projeto.cliente.telefone}`}
                  className="inline-flex items-center gap-1 hover:text-primary"
                >
                  <Phone className="size-3.5" /> {formatarTelefone(projeto.cliente.telefone)}
                </a>
              )}
              <span>Atualizado {quando(projeto.atualizadoEm.toISOString())}</span>
            </p>
            {projeto.observacoes && (
              <p className="mt-2 max-w-2xl text-sm whitespace-pre-line">{projeto.observacoes}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <MenuStatus id={projeto.id} status={projeto.status} />
            <AcoesProjeto
              projeto={{
                id: projeto.id,
                nome: projeto.nome,
                clienteId: projeto.clienteId,
                observacoes: projeto.observacoes,
              }}
              clientes={clientes}
              podeExcluir={usuario.papel === 'ADMIN'}
            />
          </div>
        </div>
      </div>
      <div className="px-4 py-6 sm:px-8">
        <AbasProjeto
          abaInicial={typeof aba === 'string' ? aba : undefined}
          projetoId={projeto.id}
          ambientes={projeto.ambientes.map((a) => ({
            id: a.id,
            nome: a.nome,
            importadoEm: a.importadoEm?.toISOString() ?? null,
            temXml: !!a.xmlOriginal,
          }))}
          modulos={projeto.ambientes.flatMap((a) =>
            a.modulos.map((m) => ({
              id: m.id,
              ambienteId: m.ambienteId,
              nome: m.nome,
              tipoId: m.tipoId,
              L: m.L,
              A: m.A,
              P: m.P,
              nPortas: m.nPortas,
              materialCaixaId: m.materialCaixaId,
              materialPortaId: m.materialPortaId,
              materialFundoId: m.materialFundoId,
              regras: m.regras as Record<string, number>,
              extras: m.extras as Record<string, number>,
            })),
          )}
          pecas={pecas.map((p): PecaVM => ({
            id: p.id,
            ambienteId: p.ambienteId,
            moduloId: p.moduloId,
            origem: p.origem,
            nome: p.nome,
            tipo: p.tipo,
            comprimento: p.comprimento,
            largura: p.largura,
            espessura: p.espessura,
            quantidade: p.quantidade,
            materialId: p.materialId,
            fita: [p.fita[0] ?? 0, p.fita[1] ?? 0, p.fita[2] ?? 0, p.fita[3] ?? 0],
            podeGirar: p.podeGirar,
            materialAlternativo: p.materialAlternativo,
          }))}
          materiais={materiais.map((m) => ({
            id: m.id,
            descricao: m.descricao,
            espessura: m.espessura,
            temVeio: m.temVeio,
            chapaComprimento: m.chapaComprimento,
            chapaLargura: m.chapaLargura,
            ativo: m.ativo,
          }))}
          tipos={projeto.tiposModulo as unknown as TipoModulo[]}
          regras={regrasProjeto}
          parametros={Object.keys(regrasProjeto).map((chave) => {
            const p = padroes.get(chave);
            return {
              chave,
              rotulo: p?.rotulo ?? chave,
              ...(p?.unidade ? { unidade: p.unidade } : {}),
              ...(p?.grupo ? { grupo: p.grupo } : {}),
              ...(p ? { padrao: p.valor } : {}),
            };
          })}
          plano={plano}
          historico={projeto.historico.map((h) => ({
            id: h.id,
            de: h.de,
            para: h.para,
            em: h.em.toISOString(),
            usuario: nomeUsuario.get(h.usuarioId) ?? 'Usuário removido',
          }))}
        />
      </div>
    </>
  );
}
