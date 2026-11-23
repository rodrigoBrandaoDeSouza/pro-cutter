import { execSync } from 'node:child_process';
import { config } from 'dotenv';
import pg from 'pg';
import { criarPrisma, hashSenha } from '@pro-cutter/db';

config({ path: '../../.env', quiet: true });

async function preparar() {
  const url = process.env.DATABASE_URL_E2E;
  if (!url) throw new Error('DATABASE_URL_E2E não definida (veja .env.example)');
  const nome = new URL(url).pathname.slice(1);
  if (!nome.endsWith('_e2e')) throw new Error(`Banco de e2e deve terminar em _e2e: ${nome}`);

  const admin = new URL(url);
  admin.pathname = '/postgres';
  const c = new pg.Client({ connectionString: admin.toString() });
  await c.connect();
  await c.query(`DROP DATABASE IF EXISTS "${nome}" WITH (FORCE)`);
  await c.query(`CREATE DATABASE "${nome}"`);
  await c.end();

  const env = { ...process.env, DATABASE_URL: url };
  execSync('npx prisma migrate deploy', { cwd: '../../packages/db', env, stdio: 'pipe' });
  execSync('npx tsx prisma/seed.ts', { cwd: '../../packages/db', env, stdio: 'pipe' });

  const prisma = criarPrisma(url);
  try {
    const empresa = await prisma.empresa.findFirstOrThrow();
    await prisma.usuario.create({
      data: {
        empresaId: empresa.id,
        nome: 'Usuária Comum',
        email: 'usuario@procutter.local',
        senhaHash: await hashSenha('usuario-teste-123'),
        papel: 'USUARIO',
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

preparar().catch((e) => {
  console.error(e);
  process.exit(1);
});
