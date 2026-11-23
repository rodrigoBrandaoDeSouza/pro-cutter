import { config } from 'dotenv';
import type { NextConfig } from 'next';

// Variáveis do .env da raiz do monorepo (DATABASE_URL etc.)
config({ path: '../../.env', quiet: true });

const nextConfig: NextConfig = {
  // Pacotes do monorepo são publicados como TypeScript (src/*.ts)
  transpilePackages: [
    '@pro-cutter/core',
    '@pro-cutter/db',
    '@pro-cutter/promob',
    '@pro-cutter/regras',
    '@pro-cutter/otimizador',
    '@pro-cutter/cvl',
  ],
  // Módulos nativos / com binários ficam fora do bundle
  serverExternalPackages: ['@node-rs/argon2', 'pg', '@prisma/adapter-pg'],
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
