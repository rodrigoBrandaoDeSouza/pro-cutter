import { execSync } from 'node:child_process';
import { config } from 'dotenv';
import pg from 'pg';

/** Recria o banco de testes e aplica as migrações antes da suíte. */
export default async function setup() {
  config({ path: new URL('../../../../.env', import.meta.url) });
  const url = process.env.DATABASE_URL_TESTE;
  if (!url) throw new Error('DATABASE_URL_TESTE não definida (veja .env.example)');
  const alvo = new URL(url);
  const nome = alvo.pathname.slice(1);
  if (!/^[a-z0-9_]+_teste$/.test(nome))
    throw new Error(`Banco de teste deve terminar em _teste: ${nome}`);

  const admin = new URL(url);
  admin.pathname = '/postgres';
  const c = new pg.Client({ connectionString: admin.toString() });
  await c.connect();
  await c.query(`DROP DATABASE IF EXISTS "${nome}" WITH (FORCE)`);
  await c.query(`CREATE DATABASE "${nome}"`);
  await c.end();

  execSync('npx prisma migrate deploy', {
    cwd: new URL('../../', import.meta.url),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
  process.env.DATABASE_URL = url;
}
