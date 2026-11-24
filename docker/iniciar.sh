#!/bin/sh
# Inicialização do container: migra o banco, cria a marcenaria inicial (só na primeira vez) e sobe o app.
set -e
cd /app/db
echo "[pro-cutter] aplicando migrações..."
./node_modules/.bin/prisma migrate deploy
cd /app/apps/web
echo "[pro-cutter] verificando marcenaria inicial..."
node seed.mjs
echo "[pro-cutter] iniciando na porta ${PORT:-3000}"
exec node server.js
