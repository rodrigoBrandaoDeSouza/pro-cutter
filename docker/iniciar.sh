#!/bin/sh
# Inicialização do container: migra o banco, cria a marcenaria inicial (só na primeira vez) e sobe o app.
set -e
cd /app/packages/db
echo "[pro-cutter] aplicando migrações..."
npx prisma migrate deploy
echo "[pro-cutter] verificando marcenaria inicial..."
npx tsx prisma/seed.ts
cd /app/apps/web
echo "[pro-cutter] iniciando na porta ${PORT:-3000}"
exec npx next start -p "${PORT:-3000}"
