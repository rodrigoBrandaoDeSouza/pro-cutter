---
name: project-deploy-vps
description: "pro-cutter publicado na VPS Hostinger (ssh bem-vps) em /opt/pro-cutter, via deploy/vps/publicar.sh; dividida com outros apps"
metadata:
  node_type: memory
  type: project
  originSessionId: 4f1dba66-f4c7-4a97-886b-c9af3166e6fd
  modified: 2026-11-24T04:43:48.026Z
---

Desde 24/11/2026 o pro-cutter roda em https://procutter.bsuite.tech (e procutter.187-53-115-2.sslip.io), na VPS da Hostinger acessada pelo alias SSH `bem-vps`. Fica em /opt/pro-cutter (compose + .env com as senhas), app em 127.0.0.1:3020, nginx do host com certificado certbot `pro-cutter`. A instância começou com os projetos fictícios do seed-demo.

**Why:** a VPS é dividida com outros apps em produção (amser, sinedu, trinar, bembordado, bsuite), tem só 1 CPU e ~2 GB livres.
**How to apply:** nunca compilar na VPS. Atualize com `deploy/vps/publicar.sh bem-vps` (gera a imagem aqui, envia por SSH, faz backup e troca a versão). Não mexa nos sites nginx nem nos containers dos outros apps. O código não passa pelo GitHub ([[project-publicacao-github]]).
