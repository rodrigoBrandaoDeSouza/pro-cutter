'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { PrismaDaEmpresa } from '@pro-cutter/db';
import {
  chaveMaterial,
  converter,
  lerListagem,
  type ConfigImportacao,
  type ListagemPromob,
} from '@pro-cutter/promob';
import { falha, sucesso, type Resultado } from '@/lib/acao';
import { lerConfiguracao } from '@/lib/server/config';
import { desatualizarPlano, materialDoBanco } from '@/lib/server/projeto';
import { dbDoUsuario } from '@/lib/server/sessao';
import { erroDoBanco, validar } from '@/lib/server/validar';

export interface MaterialDesconhecido {
  chave: string;
  modelo: string;
  espessura: number;
  descricao: string;
  /** Linhas do XML afetadas. */
  itens: number;
  /** Material ativo parecido (mesma espessura e nome parecido), se houver. */
  sugestaoId?: string;
  chapaSugerida?: { comprimento: number; largura: number };
}

export interface AnaliseXml {
  ambientes: { descricao: string; linhas: number; pecas: number }[];
  pecasProntas: number;
  desconhecidos: MaterialDesconhecido[];
  ignorados: { grupo: string; tipoPeca: string; itens: number }[];
  naoChapa: number;
  cliente: { nome: string; telefone: string };
}

function ler(xml: string): ListagemPromob | Resultado<never> {
  try {
    return lerListagem(xml);
  } catch {
    return falha('Este arquivo não parece uma listagem XML do Promob.');
  }
}

async function contexto(db: PrismaDaEmpresa) {
  const [cfg, materiais] = await Promise.all([
    lerConfiguracao(db),
    db.material.findMany({ where: { ativo: true } }),
  ]);
  const materialPorChave: Record<string, string> = {};
  for (const m of materiais) for (const c of m.chavesPromob) materialPorChave[c] = m.id;
  const config: ConfigImportacao = {
    ...cfg.importacao,
    materiais: materiais.map(materialDoBanco),
    materialPorChave,
  };
  return { config, materiais };
}

function normalizar(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const esquemaAnalise = z.object({ projetoId: z.string().min(1), xml: z.string().min(1) });

export async function analisarXml(
  entrada: z.input<typeof esquemaAnalise>,
): Promise<Resultado<AnaliseXml>> {
  const { db } = await dbDoUsuario();
  const v = validar(esquemaAnalise, entrada);
  if (!v.ok) return v;
  if (!(await db.projeto.findUnique({ where: { id: v.dados.projetoId } })))
    return falha('Projeto não encontrado.');
  const lista = ler(v.dados.xml);
  if ('ok' in lista) return lista;

  const { config, materiais } = await contexto(db);
  const desconhecidos = new Map<string, MaterialDesconhecido>();
  const ignorados = new Map<string, { grupo: string; tipoPeca: string; itens: number }>();
  let naoChapa = 0;
  let pecasProntas = 0;

  for (const amb of lista.ambientes) {
    const r = converter(amb, config);
    pecasProntas += r.pecas.reduce((s, p) => s + p.quantidade, 0);
    for (const p of r.pendencias) {
      if (p.tipo === 'nao-chapa') naoChapa += p.itens.length;
      if (p.tipo === 'ignorado') {
        const g = ignorados.get(p.grupo) ?? { grupo: p.grupo, tipoPeca: p.tipoPeca, itens: 0 };
        g.itens += p.itens.length;
        ignorados.set(p.grupo, g);
      }
      if (p.tipo === 'material-desconhecido') {
        const atual = desconhecidos.get(p.chave);
        if (atual) {
          atual.itens += p.itens.length;
          continue;
        }
        const item = amb.itens.find((i) => chaveMaterial(i) === p.chave)!;
        // sugestão: material ativo com a mesma espessura cujo nome contenha a última parte do modelo
        const final = normalizar(item.modelo.split('.').at(-1) ?? item.modelo);
        const sugestao = materiais.find(
          (m) => m.espessura === item.espessura && normalizar(m.descricao).includes(final),
        );
        desconhecidos.set(p.chave, {
          chave: p.chave,
          modelo: item.modelo,
          espessura: item.espessura,
          descricao: `${item.material} ${item.modeloDescricao || item.modelo} ${item.espessura}mm`,
          itens: p.itens.length,
          ...(sugestao ? { sugestaoId: sugestao.id } : {}),
          ...(item.chapaMax ? { chapaSugerida: item.chapaMax } : {}),
        });
      }
    }
  }

  return sucesso({
    ambientes: lista.ambientes.map((a) => ({
      descricao: a.descricao,
      linhas: a.itens.length,
      pecas: a.itens.reduce((s, i) => s + i.repeticao, 0),
    })),
    pecasProntas,
    desconhecidos: [...desconhecidos.values()],
    ignorados: [...ignorados.values()],
    naoChapa,
    cliente: { nome: lista.cliente.nome, telefone: lista.cliente.telefone },
  });
}

const esquemaNovoMaterial = z.object({
  descricao: z.string().trim().min(2),
  chapaComprimento: z.coerce.number().min(100),
  chapaLargura: z.coerce.number().min(100),
  temVeio: z.boolean(),
});

const esquemaImportacao = z.object({
  projetoId: z.string().min(1),
  xml: z.string().min(1),
  nomeArquivo: z.string().default(''),
  /** Reimportação: substitui as peças do XML deste ambiente. */
  ambienteId: z.string().optional(),
  nomeAmbiente: z.string().trim().optional(),
  /** chave do Promob → id de material existente, ou dados de material novo. */
  mapeamento: z.record(z.string(), z.union([z.string().min(1), esquemaNovoMaterial])).default({}),
});

export async function importarXml(
  entrada: z.input<typeof esquemaImportacao>,
): Promise<Resultado<{ ambientes: number; pecas: number }>> {
  const { usuario, db } = await dbDoUsuario();
  const v = validar(esquemaImportacao, entrada);
  if (!v.ok) return v;
  const { projetoId, xml, mapeamento } = v.dados;
  const projeto = await db.projeto.findUnique({
    where: { id: projetoId },
    include: { ambientes: true },
  });
  if (!projeto) return falha('Projeto não encontrado.');
  const lista = ler(xml);
  if ('ok' in lista) return lista;
  const espessuraDaChave = (chave: string) => Number(chave.split('|').at(-1));

  try {
    // 1) Grava o mapeamento: chaves novas viram parte do material (próximas importações casam sozinhas)
    for (const [chave, destino] of Object.entries(mapeamento)) {
      if (typeof destino === 'string') {
        const m = await db.material.findUnique({ where: { id: destino } });
        if (!m) return falha('Material escolhido não existe mais.');
        if (m.espessura !== espessuraDaChave(chave)) {
          return falha(`O material ${m.descricao} tem espessura diferente de ${chave}.`);
        }
        if (!m.chavesPromob.includes(chave)) {
          await db.material.update({
            where: { id: m.id },
            data: { chavesPromob: [...m.chavesPromob, chave] },
          });
        }
      } else {
        const esp = espessuraDaChave(chave);
        await db.material.create({
          data: {
            ...destino,
            empresaId: usuario.empresaId,
            espessura: esp,
            chavesPromob: [chave],
            textoProg: `MDF-${esp}-${chave.split('|')[0]}-${destino.descricao}`,
          },
        });
      }
    }

    // 2) Converte com o mapeamento atualizado: não pode sobrar material desconhecido
    const { config } = await contexto(db);
    const convertidos = lista.ambientes.map((a) => ({ amb: a, r: converter(a, config) }));
    const faltando = convertidos.flatMap(({ r }) =>
      r.pendencias.filter((p) => p.tipo === 'material-desconhecido').map((p) => p.chave),
    );
    if (faltando.length) {
      return falha(`Ainda há materiais sem correspondência: ${[...new Set(faltando)].join(', ')}`);
    }

    // 3) Cria (ou atualiza, na reimportação) os ambientes e grava as peças
    const reimportacao = v.dados.ambienteId
      ? projeto.ambientes.find((a) => a.id === v.dados.ambienteId)
      : undefined;
    if (v.dados.ambienteId && !reimportacao) return falha('Ambiente não encontrado.');
    if (reimportacao && convertidos.length !== 1) {
      return falha('Para reimportar um ambiente, use um XML com um único ambiente.');
    }

    let ordem = projeto.ambientes.length;
    let totalPecas = 0;
    for (const { amb, r } of convertidos) {
      let ambienteId: string;
      if (reimportacao) {
        ambienteId = reimportacao.id;
        await db.peca.deleteMany({ where: { ambienteId, origem: 'XML' } });
        await db.ambiente.update({
          where: { id: ambienteId },
          data: { xmlOriginal: xml, importadoEm: new Date() },
        });
      } else {
        const nome =
          (convertidos.length === 1 && v.dados.nomeAmbiente) ||
          amb.descricao ||
          v.dados.nomeArquivo.replace(/\.xml$/i, '') ||
          `Ambiente ${ordem + 1}`;
        const a = await db.ambiente.create({
          data: {
            empresaId: usuario.empresaId,
            projetoId,
            nome,
            xmlOriginal: xml,
            importadoEm: new Date(),
            ordem: ordem++,
          },
        });
        ambienteId = a.id;
      }
      await db.peca.createMany({
        data: r.pecas.map((p, i) => ({
          empresaId: usuario.empresaId,
          ambienteId,
          origem: 'XML' as const,
          nome: p.nome,
          tipo: p.tipo ?? 'outro',
          comprimento: p.comprimento,
          largura: p.largura,
          espessura: p.espessura,
          quantidade: p.quantidade,
          materialId: p.materialId,
          fita: [...p.fita],
          podeGirar: p.podeGirar,
          promobId: p.refs?.promobId ?? null,
          ordem: i,
        })),
      });
      totalPecas += r.pecas.reduce((s, p) => s + p.quantidade, 0);
    }
    await desatualizarPlano(db, projetoId);
    revalidatePath(`/projetos/${projetoId}`);
    return sucesso(
      { ambientes: convertidos.length, pecas: totalPecas },
      reimportacao
        ? `Ambiente reimportado: ${totalPecas} peças.`
        : `${convertidos.length > 1 ? `${convertidos.length} ambientes importados` : 'Ambiente importado'}: ${totalPecas} peças.`,
    );
  } catch (e) {
    return erroDoBanco(e);
  }
}

// ───────────────────────── Ambientes ─────────────────────────

export async function criarAmbiente(entrada: {
  projetoId: string;
  nome: string;
}): Promise<Resultado> {
  const { usuario, db } = await dbDoUsuario();
  const v = validar(
    z.object({ projetoId: z.string().min(1), nome: z.string().trim().min(1, 'Informe o nome') }),
    entrada,
  );
  if (!v.ok) return v;
  const n = await db.ambiente.count({ where: { projetoId: v.dados.projetoId } });
  await db.ambiente.create({ data: { ...v.dados, empresaId: usuario.empresaId, ordem: n } });
  revalidatePath(`/projetos/${v.dados.projetoId}`);
  return sucesso(null, 'Ambiente criado.');
}

export async function renomearAmbiente(entrada: { id: string; nome: string }): Promise<Resultado> {
  const { db } = await dbDoUsuario();
  const v = validar(
    z.object({ id: z.string().min(1), nome: z.string().trim().min(1, 'Informe o nome') }),
    entrada,
  );
  if (!v.ok) return v;
  const a = await db.ambiente
    .update({ where: { id: v.dados.id }, data: { nome: v.dados.nome } })
    .catch(() => null);
  if (!a) return falha('Ambiente não encontrado.');
  revalidatePath(`/projetos/${a.projetoId}`);
  return sucesso(null, 'Ambiente renomeado.');
}

export async function excluirAmbiente(id: string): Promise<Resultado> {
  const { db } = await dbDoUsuario();
  const a = await db.ambiente.findUnique({ where: { id } });
  if (!a) return falha('Ambiente não encontrado.');
  await db.ambiente.delete({ where: { id } });
  await desatualizarPlano(db, a.projetoId);
  revalidatePath(`/projetos/${a.projetoId}`);
  return sucesso(null, 'Ambiente excluído.');
}
