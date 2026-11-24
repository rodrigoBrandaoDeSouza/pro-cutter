---
name: feedback-commitar-memoria
description: Sempre incluir .claude/memory (cópia da memória do Claude Code) nos commits do pro-cutter
metadata:
  node_type: memory
  type: feedback
  originSessionId: 4f1dba66-f4c7-4a97-886b-c9af3166e6fd
  modified: 2026-11-24T13:04:32.311Z
---

A memória do Claude Code é espelhada em `.claude/memory` no repositório por um hook Stop configurado em `.claude/settings.local.json`. O usuário pediu (24/11/2026) que essa pasta vá junto nos commits.

**Why:** ele quer a memória versionada com o código.
**How to apply:** em todo commit, inclua as mudanças de `.claude/memory`. Se o hook ainda não rodou no turno, copie antes a pasta `~/.claude/projects/e--pro-cutter/memory`. A pasta cita dado real de cliente, então vale a mesma regra de não enviar ao GitHub ([[project-publicacao-github]]).
