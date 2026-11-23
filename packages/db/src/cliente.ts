import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from './generated/prisma/client.ts';

export type { PrismaClient };

/** Converte objetos tipados (interfaces) para campos Json do Prisma. */
export function json<T>(valor: T): Prisma.InputJsonValue {
  return valor as unknown as Prisma.InputJsonValue;
}

export function criarPrisma(url = process.env.DATABASE_URL): PrismaClient {
  if (!url) throw new Error('DATABASE_URL não definida');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

/** Modelos com coluna empresaId: toda consulta via `daEmpresa` é filtrada por ela. */
const MODELOS_DA_EMPRESA = new Set([
  'Configuracao',
  'Usuario',
  'Material',
  'Fita',
  'Maquina',
  'Cliente',
  'Projeto',
  'HistoricoStatus',
  'Ambiente',
  'Modulo',
  'Peca',
  'PlanoDeCorte',
]);

const COM_WHERE = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'delete',
  'deleteMany',
  'upsert',
]);

type Args = Record<string, unknown>;

/**
 * Cliente restrito a uma empresa: injeta `empresaId` no `where` de leituras/alterações e no `data`
 * de criações. Use sempre este cliente nas rotas da aplicação (nunca o PrismaClient puro).
 * Nas criações, passe `empresaId` explicitamente (o tipo do Prisma exige); a extensão garante que seja o
 * desta empresa. Criações aninhadas (nested create) não recebem empresaId: crie cada registro separadamente.
 */
export function daEmpresa(prisma: PrismaClient, empresaId: string) {
  if (!empresaId) throw new Error('empresaId obrigatório');
  return prisma.$extends({
    name: 'empresa',
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          if (!MODELOS_DA_EMPRESA.has(model)) return query(args);
          const a = { ...(args as Args) };
          if (COM_WHERE.has(operation)) a.where = { ...(a.where as Args), empresaId };
          if (operation === 'create') a.data = { ...(a.data as Args), empresaId };
          if (operation === 'upsert') a.create = { ...(a.create as Args), empresaId };
          if (operation === 'createMany' || operation === 'createManyAndReturn') {
            const dados = Array.isArray(a.data) ? a.data : [a.data];
            a.data = (dados as Args[]).map((d) => ({ ...d, empresaId }));
          }
          return query(a as typeof args);
        },
      },
    },
  });
}

export type PrismaDaEmpresa = ReturnType<typeof daEmpresa>;
