import path from 'node:path';
import { config } from 'dotenv';
import type { NextConfig } from 'next';

// Variáveis do .env da raiz do monorepo (DATABASE_URL etc.)
config({ path: '../../.env', quiet: true });

const nextConfig: NextConfig = {
  // Permite um segundo servidor (testes ponta a ponta) sem disputar a pasta .next
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  // Imagem Docker: só os arquivos que o servidor usa (o build roda em apps/web)
  ...(process.env.NEXT_STANDALONE
    ? { output: 'standalone' as const, outputFileTracingRoot: path.resolve(process.cwd(), '../..') }
    : {}),
  // Pacotes do monorepo são publicados como TypeScript (src/*.ts)
  transpilePackages: [
    '@pro-cutter/core',
    '@pro-cutter/db',
    '@pro-cutter/promob',
    '@pro-cutter/regras',
    '@pro-cutter/otimizador',
    '@pro-cutter/cvl',
    '@pro-cutter/saidas',
  ],
  // Módulos nativos / com binários ficam fora do bundle
  // XML do Promob vai pela ação do servidor (o padrão é 1 MB)
  experimental: { serverActions: { bodySizeLimit: '10mb' } },
  serverExternalPackages: ['@node-rs/argon2', 'pg', '@prisma/adapter-pg', 'qrcode', 'pdf-lib'],
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
