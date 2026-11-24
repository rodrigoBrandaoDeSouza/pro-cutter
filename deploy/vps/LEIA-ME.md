# Publicar numa VPS (Docker + nginx + certbot)

Para uma VPS que já tem outros apps atrás de um nginx com HTTPS do certbot. A imagem é gerada no seu
computador e enviada por SSH (a VPS não compila nada e o código não passa pelo GitHub).

## Primeira vez

1. Crie o registro DNS tipo A do domínio apontando para o IP da VPS.
2. No Git Bash, na raiz do projeto:

   ```bash
   DOMINIOS="procutter.exemplo.com" ADMIN_EMAIL=voce@exemplo.com EMPRESA="Minha Marcenaria" \
     deploy/vps/publicar.sh <host-ssh>
   ```

   O script cria `/opt/pro-cutter/.env` na VPS com senhas aleatórias e **mostra a senha inicial do
   admin uma única vez**. O app pede para trocá-la no primeiro acesso.

Domínios que ainda não apontam para a VPS são ignorados; publique de novo depois que o DNS propagar
e o certificado é ampliado.

## Atualizar

```bash
deploy/vps/publicar.sh <host-ssh>
```

Faz backup do banco em `/opt/pro-cutter/backups` (guarda os 10 últimos), troca a versão e espera o
app ficar saudável. A versão é o commit atual.

## Na VPS

```bash
cd /opt/pro-cutter
docker compose logs -f app                       # ver o que está acontecendo
docker compose exec app node seed-demo.mjs       # projetos fictícios (--recriar refaz)
```

Voltar para a versão anterior: troque `VERSAO` no `.env` pela tag anterior (`docker images
pro-cutter`) e rode `docker compose up -d`. Se a versão nova mudou o banco, restaure também o backup
(veja a seção Backup do INSTALACAO.md).
