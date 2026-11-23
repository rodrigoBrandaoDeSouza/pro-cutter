'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { daEmpresa, json } from '@pro-cutter/db';
import { validarTipoModulo, VARIAVEIS_DO_MODULO } from '@pro-cutter/regras';
import { falha, sucesso, type Resultado } from '@/lib/acao';
import { lerConfiguracao } from '@/lib/server/config';
import { prisma } from '@/lib/server/db';
import { exigirAdmin } from '@/lib/server/sessao';
import { erroDoBanco, validar } from '@/lib/server/validar';

async function dbAdmin() {
  const admin = await exigirAdmin();
  return { admin, db: daEmpresa(prisma, admin.empresaId) };
}

const mm = (rotulo: string, min = 0) =>
  z.coerce.number({ error: `${rotulo}: informe um número` }).min(min, `${rotulo}: mínimo ${min}`);

function concluir(mensagem: string): Resultado {
  revalidatePath('/configuracoes');
  return sucesso(null, mensagem);
}

// ───────────────────────── Materiais ─────────────────────────

const esquemaMaterial = z.object({
  id: z.string().optional(),
  descricao: z.string().trim().min(2, 'Informe a descrição'),
  espessura: mm('Espessura', 1),
  chapaComprimento: mm('Comprimento', 100),
  chapaLargura: mm('Largura', 100),
  temVeio: z.boolean(),
  chavesPromob: z.array(z.string().trim().min(1)).default([]),
  textoProg: z.string().trim().default(''),
  ativo: z.boolean().default(true),
});

export async function salvarMaterial(entrada: z.input<typeof esquemaMaterial>): Promise<Resultado> {
  const { admin, db } = await dbAdmin();
  const v = validar(esquemaMaterial, entrada);
  if (!v.ok) return v;
  const { id, textoProg, ...dados } = v.dados;
  const texto = textoProg || `MDF-${dados.espessura}-${dados.descricao}`;

  // Uma chave do Promob só pode apontar para um material
  const outros = await db.material.findMany({ where: { id: id ? { not: id } : undefined } });
  for (const chave of dados.chavesPromob) {
    const dono = outros.find((m) => m.chavesPromob.includes(chave));
    if (dono) {
      return falha(`A chave "${chave}" já está no material ${dono.descricao}.`, {
        chavesPromob: 'Chave repetida em outro material',
      });
    }
  }
  try {
    if (id) await db.material.update({ where: { id }, data: { ...dados, textoProg: texto } });
    else
      await db.material.create({
        data: { ...dados, textoProg: texto, empresaId: admin.empresaId },
      });
  } catch (e) {
    return erroDoBanco(e);
  }
  return concluir(id ? 'Material atualizado.' : 'Material cadastrado.');
}

export async function excluirMaterial(id: string): Promise<Resultado> {
  const { db } = await dbAdmin();
  const usos = await db.peca.count({ where: { materialId: id } });
  if (usos > 0) {
    await db.material.update({ where: { id }, data: { ativo: false } });
    return concluir('O material está em uso em projetos: foi desativado em vez de excluído.');
  }
  try {
    await db.material.delete({ where: { id } });
  } catch (e) {
    return erroDoBanco(e);
  }
  return concluir('Material excluído.');
}

// ───────────────────────── Fitas ─────────────────────────

const esquemaFita = z.object({
  id: z.string().optional(),
  cor: z.string().trim().min(1, 'Informe a cor'),
  espessura: mm('Espessura', 0.1),
});

export async function salvarFita(entrada: z.input<typeof esquemaFita>): Promise<Resultado> {
  const { admin, db } = await dbAdmin();
  const v = validar(esquemaFita, entrada);
  if (!v.ok) return v;
  const { id, ...dados } = v.dados;
  try {
    if (id) await db.fita.update({ where: { id }, data: dados });
    else await db.fita.create({ data: { ...dados, empresaId: admin.empresaId } });
  } catch (e) {
    return erroDoBanco(e);
  }
  return concluir(id ? 'Fita atualizada.' : 'Fita cadastrada.');
}

export async function excluirFita(id: string): Promise<Resultado> {
  const { db } = await dbAdmin();
  try {
    await db.fita.delete({ where: { id } });
  } catch (e) {
    return erroDoBanco(e);
  }
  return concluir('Fita excluída.');
}

// ───────────────────────── Máquina ─────────────────────────

const esquemaMaquina = z.object({
  id: z.string(),
  nome: z.string().trim().min(2, 'Informe o nome'),
  serra: mm('Serra', 0.5).max(10, 'Serra: máximo 10 mm'),
  refiloFabrica: mm('Refilo', 0),
  refiloSerrado: mm('Refilo', 0),
  niveisMax: z.coerce.number().int().min(2).max(3),
  sobraMinComp: mm('Sobra mínima', 0),
  sobraMinLarg: mm('Sobra mínima', 0),
});

export async function salvarMaquina(entrada: z.input<typeof esquemaMaquina>): Promise<Resultado> {
  const { db } = await dbAdmin();
  const v = validar(esquemaMaquina, entrada);
  if (!v.ok) return v;
  const { id, ...dados } = v.dados;
  try {
    await db.maquina.update({ where: { id }, data: dados });
  } catch (e) {
    return erroDoBanco(e);
  }
  return concluir('Máquina atualizada.');
}

// ───────────────────────── Regras ─────────────────────────

const RESERVADAS = new Set<string>(VARIAVEIS_DO_MODULO);

const esquemaRegras = z
  .array(
    z.object({
      chave: z
        .string()
        .trim()
        .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'Use só letras, números e _ (sem espaço nem acento)')
        .refine((c) => !RESERVADAS.has(c), 'Nome reservado (L, A, P, nPortas, esp…)'),
      rotulo: z.string().trim().min(1, 'Informe o rótulo'),
      valor: z.coerce.number({ error: 'Informe um número' }),
      unidade: z.string().trim().optional(),
      grupo: z.string().trim().optional(),
      ajuda: z.string().trim().optional(),
    }),
  )
  .refine(
    (l) => new Set(l.map((p) => p.chave)).size === l.length,
    'Há parâmetros com o mesmo nome',
  );

export async function salvarRegras(entrada: z.input<typeof esquemaRegras>): Promise<Resultado> {
  const { db } = await dbAdmin();
  const v = validar(esquemaRegras, entrada);
  if (!v.ok) return v;
  const cfg = await lerConfiguracao(db);
  const chaves = v.dados.map((p) => p.chave);
  const quebradas = cfg.tiposModulo.flatMap((t) =>
    validarTipoModulo(t, chaves).map((e) => `${t.nome} › ${e.peca}: ${e.mensagem}`),
  );
  if (quebradas.length) {
    return falha(`Essa mudança quebra fórmulas: ${quebradas.slice(0, 3).join('; ')}`);
  }
  await db.configuracao.update({
    where: { id: cfg.id },
    data: { regras: json(v.dados), versao: { increment: 1 } },
  });
  return concluir('Regras salvas. Valem para os próximos projetos.');
}

// ───────────────────────── Fórmulas (tipos de módulo) ─────────────────────────

const formula = z.string().trim().min(1, 'Informe a fórmula');
const esquemaTipos = z.array(
  z.object({
    id: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]+$/, 'Identificador: letras minúsculas, números e -'),
    nome: z.string().trim().min(1, 'Informe o nome'),
    extras: z
      .array(
        z.object({
          chave: z.string().trim().min(1),
          rotulo: z.string().trim(),
          padrao: z.coerce.number(),
        }),
      )
      .optional(),
    pecas: z.array(
      z.object({
        nome: z.string().trim().min(1, 'Informe o nome da peça'),
        tipo: z.string().trim().min(1),
        material: z.enum(['caixa', 'porta', 'fundo']),
        quantidade: formula,
        comprimento: formula,
        largura: formula,
        condicao: z.string().trim().optional(),
        podeGirar: z.boolean().optional(),
        fita: z.tuple([z.number(), z.number(), z.number(), z.number()]),
      }),
    ),
  }),
);

export async function salvarTiposModulo(entrada: z.input<typeof esquemaTipos>): Promise<Resultado> {
  const { db } = await dbAdmin();
  const v = validar(esquemaTipos, entrada);
  if (!v.ok) return v;
  if (new Set(v.dados.map((t) => t.id)).size !== v.dados.length) {
    return falha('Há tipos de módulo com o mesmo identificador.');
  }
  const cfg = await lerConfiguracao(db);
  const chaves = cfg.regras.map((r) => r.chave);
  const tipos = v.dados.map((t) => ({
    ...t,
    pecas: t.pecas.map((p) => ({ ...p, condicao: p.condicao || undefined })),
  }));
  const erros = tipos.flatMap((t) =>
    validarTipoModulo(t, chaves).map((e) => `${t.nome} › ${e.peca} (${e.campo}): ${e.mensagem}`),
  );
  if (erros.length) return falha(`Corrija as fórmulas: ${erros.slice(0, 3).join('; ')}`);

  await db.configuracao.update({
    where: { id: cfg.id },
    data: { tiposModulo: json(tipos), versao: { increment: 1 } },
  });
  return concluir('Fórmulas salvas. Valem para os próximos projetos.');
}

// ───────────────────────── Importação e etiqueta ─────────────────────────

const BORDA = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
const esquemaImportacao = z.object({
  mapaGrupos: z.record(z.string(), z.string().trim().min(1)),
  origemPorTipo: z.record(z.string(), z.enum(['promob', 'pro-cutter'])),
  ladosFita: z
    .tuple([BORDA, BORDA, BORDA, BORDA])
    .refine((l) => new Set(l).size === 4, 'Cada lado do Promob deve ir para uma borda diferente'),
});

export async function salvarImportacao(
  entrada: z.input<typeof esquemaImportacao>,
): Promise<Resultado> {
  const { db } = await dbAdmin();
  const v = validar(esquemaImportacao, entrada);
  if (!v.ok) return v;
  const cfg = await lerConfiguracao(db);
  await db.configuracao.update({
    where: { id: cfg.id },
    data: { importacao: json(v.dados), versao: { increment: 1 } },
  });
  return concluir('Configuração de importação salva.');
}

const esquemaEtiqueta = z.object({
  largura: mm('Largura', 20).max(200, 'Largura: máximo 200 mm'),
  altura: mm('Altura', 15).max(200, 'Altura: máximo 200 mm'),
});

export async function salvarEtiqueta(entrada: z.input<typeof esquemaEtiqueta>): Promise<Resultado> {
  const { db } = await dbAdmin();
  const v = validar(esquemaEtiqueta, entrada);
  if (!v.ok) return v;
  const cfg = await lerConfiguracao(db);
  await db.configuracao.update({ where: { id: cfg.id }, data: { etiqueta: json(v.dados) } });
  return concluir('Tamanho da etiqueta salvo.');
}
