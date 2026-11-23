# pro-cutter

Planejador de corte de chapas de MDF para marcenarias: importa a listagem XML do Promob, gera portas e fundos por regras configuráveis, otimiza o corte guilhotina e exporta os programas `.prog` da seccionadora **CVL Máxima**.

Design e decisões em [.doc/design.md](.doc/design.md); plano em [.doc/plano-implementacao.md](.doc/plano-implementacao.md).

## Rodando no computador

Requisitos: Node 22+ e Docker.

```bash
npm install
cp .env.example .env          # ajuste se precisar
npm run db:up                 # PostgreSQL no Docker
npm run db:migrate            # cria as tabelas
npm run db:seed               # marcenaria inicial + admin
npm run dev                   # http://localhost:3000
```

O seed cria o admin `admin@procutter.local` com a senha `trocar-esta-senha` (ou `SEED_ADMIN_EMAIL` / `SEED_ADMIN_SENHA`). **Troque a senha no primeiro acesso.**

## Testes

```bash
npm test          # unidade + integração (banco *_teste criado automaticamente)
npm run e2e       # ponta a ponta no navegador (precisa do db:up e do seed)
npm run typecheck
npm run lint
```

## Estrutura

| Pasta | O quê |
|---|---|
| `apps/web` | Next.js: telas, ações do servidor, login |
| `packages/core` | Tipos, geometria da árvore de cortes, validador, métricas |
| `packages/promob` | Leitura e conversão do XML do Promob |
| `packages/cvl` | Leitura, geração e verificação dos `.prog` da CVL |
| `packages/otimizador` | Corte guilhotina em até 3 níveis |
| `packages/regras` | Fórmulas de porta e fundo |
| `packages/db` | Banco (Prisma), isolamento por empresa, autenticação |
