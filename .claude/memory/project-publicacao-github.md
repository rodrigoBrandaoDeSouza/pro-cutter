---
name: project-publicacao-github
description: Repo GitHub do pro-cutter é PÚBLICO e o histórico tem dados reais (.doc/models); usuário decidiu não enviar por enquanto (24/11/2026)
metadata:
  node_type: memory
  type: project
  originSessionId: 4f1dba66-f4c7-4a97-886b-c9af3166e6fd
  modified: 2026-11-24T02:22:24.082Z
---

O remoto `origin` (github.com/rodrigoBrandaoDeSouza/pro-cutter) é **público** e estava vazio em 24/11/2026. O histórico local (main + feat/v1) contém `.doc/models` com dados reais: nome do cliente "Everaldo Gobbi", número de série e código de produto da licença do Promob, e o projeto `angela.promob`/`.bak`. Esses arquivos são fixtures de testes (ida e volta byte a byte dos .prog).

Perguntado, o usuário escolheu **não enviar nada ao GitHub por enquanto**. O `gh` CLI não está instalado na máquina.

**Why:** publicar exporia dados de cliente e da licença do Promob.
**How to apply:** nunca dar push sem antes o usuário tornar o repositório privado ou pedir a anonimização do histórico (trocar nomes e números por fictícios mantendo os testes). Relacionado a [[project-pro-cutter]].
