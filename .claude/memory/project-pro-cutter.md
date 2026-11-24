---
name: project-pro-cutter
description: pro-cutter = planejador de corte de MDF web (Promob XML → otimizador guilhotina → .prog CVL Máxima); docs em .doc/
metadata:
  node_type: memory
  type: project
  originSessionId: 4f1dba66-f4c7-4a97-886b-c9af3166e6fd
  modified: 2026-11-23T19:49:29.332Z
---

pro-cutter é um planejador de corte de chapas de MDF para marcenarias (início: 23/11/2026). Importa a listagem XML do Promob, gera portas e fundos por fórmulas configuráveis, otimiza o corte guilhotina em 3 níveis e exporta `.prog` para a seccionadora CVL Máxima.

Fonte da verdade: `.doc/design.md`, `.doc/plano-implementacao.md`, `.doc/brainstorm-decisoes.md`. Fixtures reais em `.doc/models/`.

**Why:** o usuário conduziu um brainstorm longo; as decisões estão registradas nesses docs, e não no código.
**How to apply:** antes de mudar o escopo, consultar o design. O código fica no branch `feat/v1` (a `main` só tem os docs). v1 completa em 24/11/2026; falta validar na CVL e decidir a publicação ([[project-publicacao-github]]). O usuário escreve em português do Brasil e quer UI moderna e fácil de usar ([[feedback-ui-moderna]]).
