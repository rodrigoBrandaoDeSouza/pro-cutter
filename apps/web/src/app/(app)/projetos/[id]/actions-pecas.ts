'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { json, type PrismaDaEmpresa } from '@pro-cutter/db';
import {
  validarTipoModulo,
  valoresDe,
  type TipoModulo,
  type ValoresRegras,
} from '@pro-cutter/regras';
import { falha, sucesso, type Resultado } from '@/lib/acao';
import { lerConfiguracao } from '@/lib/server/config';
import {
  calcularPecasDoModulo,
  desatualizarPlano,
  gravarPecasGeradas,
  materialDoBanco,
  moduloDoBanco,
} from '@/lib/server/projeto';
import { dbDoUsuario } from '@/lib/server/sessao';
import { erroDoBanco, validar } from '@/lib/server/validar';

const num = (rotulo: string, min = 0) =>
  z.coerce.number({ error: `${rotulo}: informe um número` }).min(min, `${rotulo}: mínimo ${min}`);

async function carregarProjeto(db: PrismaDaEmpresa, projetoId: string) {
  const projeto = await db.projeto.findUnique({ where: { id: projetoId } });
  if (!projeto) return null;
  return {
    ...projeto,
    regras: projeto.regras as unknown as ValoresRegras,
    tiposModulo: projeto.tiposModulo as unknown as TipoModulo[],
  };
}

function concluir(projetoId: string, mensagem: string) {
  revalidatePath(`/projetos/${projetoId}`);
  return sucesso(null, mensagem);
}

// ───────────────────────── Módulos ─────────────────────────

const esquemaModulo = z.object({
  projetoId: z.string().min(1),
  ambienteId: z.string().min(1),
  id: z.string().optional(),
  nome: z.string().trim().min(1, 'Informe o nome do módulo'),
  tipoId: z.string().min(1, 'Escolha o tipo'),
  L: num('Largura', 1),
  A: num('Altura', 1),
  P: num('Profundidade', 1),
  nPortas: z.coerce.number().int().min(0, 'Portas: mínimo 0').max(20),
  materialCaixaId: z.string().min(1, 'Escolha o material da caixa'),
  materialPortaId: z.string().optional(),
  materialFundoId: z.string().optional(),
  regras: z.record(z.string(), z.coerce.number()).default({}),
  extras: z.record(z.string(), z.coerce.number()).default({}),
});

export async function salvarModulo(entrada: z.input<typeof esquemaModulo>): Promise<Resultado> {
  const { usuario, db } = await dbDoUsuario();
  const v = validar(esquemaModulo, entrada);
  if (!v.ok) return v;
  const { projetoId, id, ...d } = v.dados;
  const projeto = await carregarProjeto(db, projetoId);
  if (!projeto) return falha('Projeto não encontrado.');
  const ambiente = await db.ambiente.findUnique({ where: { id: d.ambienteId } });
  if (!ambiente || ambiente.projetoId !== projetoId) return falha('Ambiente não encontrado.');

  const materiais = (await db.material.findMany()).map(materialDoBanco);
  const dados = {
    ...d,
    materialPortaId: d.materialPortaId || null,
    materialFundoId: d.materialFundoId || null,
  };
  // Calcula antes de gravar: com erro nas fórmulas, nada muda
  const previa = calcularPecasDoModulo(
    moduloDoBanco({ ...dados, id: id ?? 'novo' }),
    projeto.tiposModulo,
    projeto.regras,
    materiais,
  );
  if (previa.erros.length) {
    return falha(previa.erros.map((e) => `${e.peca}: ${e.mensagem}`).join(' · '));
  }

  try {
    const salvo = id
      ? await db.modulo.update({
          where: { id },
          data: { ...dados, regras: json(dados.regras), extras: json(dados.extras) },
        })
      : await db.modulo.create({
          data: {
            ...dados,
            regras: json(dados.regras),
            extras: json(dados.extras),
            empresaId: usuario.empresaId,
            ordem: await db.modulo.count({ where: { ambienteId: d.ambienteId } }),
          },
        });
    const modulo = moduloDoBanco(salvo);
    const { pecas } = calcularPecasDoModulo(modulo, projeto.tiposModulo, projeto.regras, materiais);
    await gravarPecasGeradas(
      db,
      usuario.empresaId,
      { ...modulo, ambienteId: salvo.ambienteId },
      pecas,
    );
    await desatualizarPlano(db, projetoId);
    const n = pecas.reduce((s, p) => s + p.quantidade, 0);
    return concluir(
      projetoId,
      `${id ? 'Módulo atualizado' : 'Módulo criado'}: ${n} peça(s) gerada(s).`,
    );
  } catch (e) {
    return erroDoBanco(e);
  }
}

export async function excluirModulo(id: string): Promise<Resultado> {
  const { db } = await dbDoUsuario();
  const m = await db.modulo.findUnique({ where: { id }, include: { ambiente: true } });
  if (!m) return falha('Módulo não encontrado.');
  await db.modulo.delete({ where: { id } }); // peças geradas vão junto (cascade)
  await desatualizarPlano(db, m.ambiente.projetoId);
  return concluir(m.ambiente.projetoId, 'Módulo excluído.');
}

// ───────────────────────── Peças ─────────────────────────

const esquemaPeca = z.object({
  projetoId: z.string().min(1),
  ambienteId: z.string().min(1, 'Escolha o ambiente'),
  id: z.string().optional(),
  nome: z.string().trim().min(1, 'Informe o nome'),
  tipo: z.string().trim().default('outro'),
  comprimento: num('Comprimento', 1),
  largura: num('Largura', 1),
  quantidade: z.coerce.number().int().min(1, 'Quantidade: mínimo 1'),
  materialId: z.string().min(1, 'Escolha o material'),
  fita: z.tuple([z.coerce.number(), z.coerce.number(), z.coerce.number(), z.coerce.number()]),
  podeGirar: z.boolean(),
  materialAlternativo: z.boolean().default(false),
});

export async function salvarPeca(entrada: z.input<typeof esquemaPeca>): Promise<Resultado> {
  const { usuario, db } = await dbDoUsuario();
  const v = validar(esquemaPeca, entrada);
  if (!v.ok) return v;
  const { projetoId, id, ...d } = v.dados;
  const ambiente = await db.ambiente.findUnique({ where: { id: d.ambienteId } });
  if (!ambiente || ambiente.projetoId !== projetoId) return falha('Ambiente não encontrado.');
  const material = await db.material.findUnique({ where: { id: d.materialId } });
  if (!material) return falha('Material não encontrado.');

  // Chapa útil mínima (sem refilos): peça maior que a chapa nunca vai caber
  const cabe =
    (d.comprimento <= material.chapaComprimento && d.largura <= material.chapaLargura) ||
    (!material.temVeio &&
      d.podeGirar &&
      d.largura <= material.chapaComprimento &&
      d.comprimento <= material.chapaLargura);
  if (!cabe) {
    return falha(
      `A peça não cabe na chapa ${material.chapaComprimento} × ${material.chapaLargura}.`,
      {
        comprimento: 'Maior que a chapa',
      },
    );
  }

  try {
    if (id) {
      const atual = await db.peca.findUnique({ where: { id } });
      if (!atual) return falha('Peça não encontrada.');
      if (atual.origem === 'GERADA')
        return falha('Peças geradas por módulo são alteradas pelo módulo.');
      await db.peca.update({ where: { id }, data: { ...d, espessura: material.espessura } });
    } else {
      await db.peca.create({
        data: {
          ...d,
          espessura: material.espessura,
          origem: 'MANUAL',
          empresaId: usuario.empresaId,
        },
      });
    }
  } catch (e) {
    return erroDoBanco(e);
  }
  await desatualizarPlano(db, projetoId);
  return concluir(projetoId, id ? 'Peça atualizada.' : 'Peça avulsa adicionada.');
}

export async function excluirPeca(id: string): Promise<Resultado> {
  const { db } = await dbDoUsuario();
  const p = await db.peca.findUnique({ where: { id }, include: { ambiente: true } });
  if (!p) return falha('Peça não encontrada.');
  if (p.origem === 'GERADA') return falha('Para remover peças geradas, edite ou exclua o módulo.');
  await db.peca.delete({ where: { id } });
  await desatualizarPlano(db, p.ambiente.projetoId);
  return concluir(p.ambiente.projetoId, 'Peça removida.');
}

// ───────────────────────── Regras do projeto ─────────────────────────

/** Recalcula as peças de todos os módulos do projeto. Devolve os erros (módulo › peça: mensagem). */
async function recalcularModulos(
  db: PrismaDaEmpresa,
  empresaId: string,
  projetoId: string,
): Promise<string[]> {
  const projeto = await carregarProjeto(db, projetoId);
  if (!projeto) return ['Projeto não encontrado.'];
  const materiais = (await db.material.findMany()).map(materialDoBanco);
  const modulos = await db.modulo.findMany({ where: { ambiente: { projetoId } } });
  const erros: string[] = [];
  for (const m of modulos) {
    const modulo = moduloDoBanco(m);
    const r = calcularPecasDoModulo(modulo, projeto.tiposModulo, projeto.regras, materiais);
    if (r.erros.length) {
      erros.push(...r.erros.map((e) => `${m.nome} › ${e.peca}: ${e.mensagem}`));
      continue; // mantém as peças anteriores desse módulo
    }
    await gravarPecasGeradas(db, empresaId, { ...modulo, ambienteId: m.ambienteId }, r.pecas);
  }
  return erros;
}

const esquemaRegrasProjeto = z.object({
  projetoId: z.string().min(1),
  regras: z.record(z.string(), z.coerce.number({ error: 'Informe um número' })),
});

export async function salvarRegrasProjeto(
  entrada: z.input<typeof esquemaRegrasProjeto>,
): Promise<Resultado> {
  const { usuario, db } = await dbDoUsuario();
  const v = validar(esquemaRegrasProjeto, entrada);
  if (!v.ok) return v;
  const projeto = await carregarProjeto(db, v.dados.projetoId);
  if (!projeto) return falha('Projeto não encontrado.');
  const desconhecidas = Object.keys(v.dados.regras).filter(
    (k) => !Object.hasOwn(projeto.regras, k),
  );
  if (desconhecidas.length) return falha(`Parâmetro desconhecido: ${desconhecidas.join(', ')}`);

  await db.projeto.update({
    where: { id: projeto.id },
    data: { regras: json({ ...projeto.regras, ...v.dados.regras }) },
  });
  const erros = await recalcularModulos(db, usuario.empresaId, projeto.id);
  await desatualizarPlano(db, projeto.id);
  revalidatePath(`/projetos/${projeto.id}`);
  if (erros.length)
    return falha(
      `Regras salvas, mas alguns módulos não recalcularam: ${erros.slice(0, 3).join(' · ')}`,
    );
  return sucesso(null, 'Regras do projeto salvas e peças recalculadas.');
}

/** Traz as fórmulas atuais das Configurações e os parâmetros novos (sem mexer nos valores já ajustados). */
export async function atualizarFormulasDoProjeto(projetoId: string): Promise<Resultado> {
  const { usuario, db } = await dbDoUsuario();
  const projeto = await carregarProjeto(db, projetoId);
  if (!projeto) return falha('Projeto não encontrado.');
  const cfg = await lerConfiguracao(db);
  const regras = { ...valoresDe(cfg.regras), ...projeto.regras };
  // Parâmetros removidos das Configurações saem do projeto se nenhuma fórmula nova os usa
  const chaves = cfg.regras.map((r) => r.chave);
  const quebrados = cfg.tiposModulo.flatMap((t) => validarTipoModulo(t, Object.keys(regras)));
  if (quebrados.length)
    return falha('As fórmulas das Configurações têm erros; corrija lá primeiro.');
  const limpas = Object.fromEntries(Object.entries(regras).filter(([k]) => chaves.includes(k)));

  await db.projeto.update({
    where: { id: projetoId },
    data: { tiposModulo: json(cfg.tiposModulo), regras: json(limpas) },
  });
  const erros = await recalcularModulos(db, usuario.empresaId, projetoId);
  await desatualizarPlano(db, projetoId);
  revalidatePath(`/projetos/${projetoId}`);
  if (erros.length)
    return falha(`Fórmulas atualizadas, mas há módulos com erro: ${erros.slice(0, 3).join(' · ')}`);
  return sucesso(null, 'Fórmulas atualizadas a partir das Configurações.');
}
