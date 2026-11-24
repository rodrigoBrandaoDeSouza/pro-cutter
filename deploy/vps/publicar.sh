#!/usr/bin/env bash
# Publica o pro-cutter numa VPS com Docker + nginx + certbot. Roda no seu computador (Git Bash).
#
#   deploy/vps/publicar.sh <host-ssh>
#
# Variáveis (só necessárias na primeira vez; depois ficam no /opt/pro-cutter/.env da VPS):
#   DOMINIOS="procutter.exemplo.com"   domínios separados por espaço (HTTPS só para os que já resolvem)
#   ADMIN_EMAIL=voce@exemplo.com       e-mail do administrador inicial
#   EMPRESA="Minha Marcenaria"         nome da marcenaria
#   PORTA=3020                         porta local na VPS (o nginx encaminha para ela)
#
# O que faz: gera a imagem aqui (a VPS não compila), envia por SSH, faz backup do banco, sobe a
# versão nova, configura o nginx e pede o certificado HTTPS. Nada passa pelo GitHub.
set -euo pipefail

HOST=${1:?uso: deploy/vps/publicar.sh <host-ssh>}
DIR=/opt/pro-cutter
RAIZ=$(cd "$(dirname "$0")/../.." && pwd)
cd "$RAIZ"

# VERSAO=<tag> publica (ou volta para) uma imagem já gerada, sem compilar de novo
if [ -z "${VERSAO:-}" ]; then
  VERSAO=$(git rev-parse --short HEAD)
  [ -n "$(git status --porcelain)" ] && VERSAO="$VERSAO-$(date +%Y%m%d%H%M)"
fi
echo "==> versão $VERSAO"

if docker image inspect "pro-cutter:$VERSAO" >/dev/null 2>&1; then
  echo "==> imagem $VERSAO já existe aqui"
else
  echo "==> gerando a imagem"
  docker build -t "pro-cutter:$VERSAO" .
fi

if ssh "$HOST" "docker image inspect pro-cutter:$VERSAO >/dev/null 2>&1"; then
  echo "==> a VPS já tem a imagem $VERSAO"
else
  echo "==> enviando a imagem para $HOST (pode levar alguns minutos)"
  docker save "pro-cutter:$VERSAO" | gzip -1 | ssh "$HOST" 'gunzip | docker load'
fi

ssh "$HOST" "mkdir -p $DIR/backups"
scp -q deploy/vps/docker-compose.yml "$HOST:$DIR/docker-compose.yml"
scp -q deploy/vps/nginx.conf "$HOST:$DIR/nginx.conf"

# O ssh junta os argumentos num texto só: cada valor vai escapado (%q) para não quebrar nos espaços
VARS=$(printf '%q=%q ' VERSAO "$VERSAO" DIR "$DIR" DOMINIOS "${DOMINIOS:-}" \
  ADMIN_EMAIL "${ADMIN_EMAIL:-}" EMPRESA "${EMPRESA:-Minha Marcenaria}" PORTA "${PORTA:-3020}")
ssh "$HOST" "$VARS bash -s" <<'REMOTO'
set -euo pipefail
cd "$DIR"

# Primeira vez: cria o .env com senhas aleatórias
if [ ! -f .env ]; then
  [ -n "$ADMIN_EMAIL" ] || { echo "Primeira publicação: defina ADMIN_EMAIL"; exit 1; }
  [ -n "$DOMINIOS" ] || { echo "Primeira publicação: defina DOMINIOS"; exit 1; }
  SENHA_ADMIN=$(openssl rand -base64 12 | tr -d '/+=')
  umask 077
  cat > .env <<EOF
VERSAO=$VERSAO
PORTA=$PORTA
DOMINIOS="$DOMINIOS"
POSTGRES_SENHA=$(openssl rand -hex 24)
SEED_EMPRESA="$EMPRESA"
SEED_ADMIN_EMAIL=$ADMIN_EMAIL
SEED_ADMIN_SENHA=$SENHA_ADMIN
EOF
  echo "==> .env criado. Senha inicial do admin ($ADMIN_EMAIL): $SENHA_ADMIN"
fi
set -a; . ./.env; set +a
[ -n "${DOMINIOS:-}" ] || { echo "DOMINIOS vazio no .env"; exit 1; }

# Backup antes de trocar a versão (guarda os 10 últimos)
if docker compose ps --status running banco 2>/dev/null | grep -q banco; then
  ARQ="backups/procutter-$(date +%Y%m%d-%H%M%S).dump"
  docker compose exec -T banco pg_dump -U procutter -Fc procutter > "$ARQ"
  echo "==> backup: $DIR/$ARQ"
  ls -1t backups/*.dump | tail -n +11 | xargs -r rm -f
fi

sed -i "s/^VERSAO=.*/VERSAO=$VERSAO/" .env
docker compose up -d
echo "==> aguardando o app ficar saudável"
for i in $(seq 1 60); do
  estado=$(docker inspect -f '{{.State.Health.Status}}' pro-cutter-app-1 2>/dev/null || echo "?")
  [ "$estado" = healthy ] && break
  sleep 3
done
[ "$estado" = healthy ] || { docker compose logs --tail 50 app; echo "App não ficou saudável"; exit 1; }
echo "==> app no ar (127.0.0.1:$PORTA)"

# nginx + HTTPS: só entram os domínios que já apontam para esta VPS. O site é recriado a cada
# publicação a partir do modelo e o certbot reinstala um único certificado (cert-name pro-cutter)
# com todos eles; um domínio novo no DNS entra na próxima publicação (--expand).
IP=$(curl -4 -s --max-time 5 https://api.ipify.org || hostname -I | awk '{print $1}')
ATIVOS=""
for d in $DOMINIOS; do
  if [ "$(getent ahostsv4 "$d" | awk 'NR==1{print $1}')" = "$IP" ]; then
    ATIVOS="$ATIVOS $d"
  else
    echo "==> $d ainda não aponta para $IP (crie o registro DNS A e publique de novo)"
  fi
done
ATIVOS=$(echo $ATIVOS)
[ -n "$ATIVOS" ] || { echo "Nenhum domínio aponta para esta VPS ainda."; exit 1; }

SITE=/etc/nginx/sites-available/pro-cutter
sed -e "s/DOMINIOS/$ATIVOS/" -e "s/PORTA/$PORTA/" nginx.conf > "$SITE"
ln -sf "$SITE" /etc/nginx/sites-enabled/pro-cutter
nginx -t && systemctl reload nginx
ARGS=""
for d in $ATIVOS; do ARGS="$ARGS -d $d"; done
certbot --nginx --cert-name pro-cutter $ARGS --non-interactive --redirect --expand \
  --keep-until-expiring
for d in $ATIVOS; do echo "==> no ar: https://$d"; done

# Limpa imagens antigas do pro-cutter (mantém a atual e a anterior)
docker images pro-cutter --format '{{.Tag}} {{.CreatedAt}}' | sort -k2 -r | awk 'NR>2{print $1}' \
  | xargs -r -I{} docker rmi "pro-cutter:{}" >/dev/null 2>&1 || true
echo "==> pronto: versão $VERSAO"
REMOTO
