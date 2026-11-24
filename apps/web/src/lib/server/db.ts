import 'server-only';
import { criarPrisma, type PrismaClient } from '@pro-cutter/db';

// Uma conexão por processo (no dev, sobrevive ao hot reload).
const global = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = global.prisma ?? criarPrisma();
if (process.env.NODE_ENV !== 'production') global.prisma = prisma;
