# pro-cutter: Plano de implementação da v1

> **Referência:** [design.md](design.md). Cada tarefa é pequena, testável e termina com commit.
> **Método:** TDD. Primeiro o teste falhando, depois a implementação mínima, depois refatorar, depois commit.
> **Ordem:** núcleo puro primeiro (sem web nem banco, validado com os arquivos reais de `.doc/models/`), depois banco, telas e saídas.

## Ambiente

- Node 24, **npm workspaces** (o pnpm via corepack exigiria permissão de administrador nesta máquina), Docker (PostgreSQL 16 em `docker-compose.yml`)
- Monorepo com npm workspaces, TypeScript 5 em modo `strict`, **Vitest**, **fast-check** (testes de propriedade), ESLint e Prettier
- Os arquivos de `.doc/models/` são **fixtures de teste**, referenciados por caminho (não copiados)

## Estrutura final

```
pro-cutter/
├─ apps/web/                 Next.js (App Router): telas, rotas de API, auth
├─ packages/core/            tipos de domínio + geometria + validador de plano
├─ packages/promob/          importador do XML do Promob
├─ packages/cvl/             leitor e gerador de .prog (CVL Máxima)
├─ packages/otimizador/      corte guilhotina em níveis
├─ packages/regras/          avaliador de expressões + geração de portas/fundos
├─ packages/saidas/          PDFs (desenho, sequência, etiquetas), relatório, ZIP
├─ packages/db/              schema Prisma + cliente + seed
├─ docker-compose.yml
└─ .doc/
```

Dependências entre pacotes (sem ciclos): `core` ← `promob`, `cvl`, `otimizador`, `regras` ← `saidas` ← `web`; `db` ← `web`.

---

## Fase 0: Fundação do repositório

### Tarefa 0.1: Monorepo
- Criar: `package.json` (raiz, `"private": true`, scripts `test`, `lint`, `typecheck`, `build`), `workspaces` no package.json (`apps/*`, `packages/*`), `tsconfig.base.json` (strict, `moduleResolution: bundler`, `target: ES2022`), `.gitignore` (node_modules, .next, dist, .env*, coverage), `.editorconfig`, `.prettierrc`, `eslint.config.mjs`, `vitest.workspace.ts`
- `npm install`
- **Pronto quando:** `npm test` roda e `npm run typecheck` passa
- Commit: `chore: monorepo base (pnpm, ts, vitest, eslint)`

### Tarefa 0.2: Pacote `core` com tipos de domínio
- Criar `packages/core/src/tipos.ts`:
  - `Material { id, descricao, espessura, chapa: { comprimento, largura }, temVeio }`
  - `Peca { id, nome, comprimento, largura, espessura, quantidade, materialId, fita: [n,n,n,n], podeGirar, origem: 'xml'|'gerada'|'manual', refs: { ambiente?, modulo?, promobId? } }`
  - `ParametrosCorte { serra, refiloFabrica, refiloSerrado, niveisMax, sobraMinima: {c,l} }`
  - **Árvore de cortes**: `NoCorte { nivel: '1X'|'1Y'|'2X'|'2Y'|'3X'|'3Y', medida, refilo?: number, filhos: NoCorte[], pecaId?: string }`
  - `ChapaPlano { materialId, numero, comprimento, largura, raiz: NoCorte[], inicio: 'X'|'Y' }`
  - `Plano { chapas: ChapaPlano[] }`
- Criar `packages/core/src/geometria.ts`: `posicionar(chapa, params)` → lista de retângulos `{pecaId, x, y, c, l, girada}`, cortes `{nivel, x1, y1, x2, y2}` e sobras, calculados a partir da árvore. A árvore é a fonte da verdade; a geometria é derivada dela.
- Testes: árvore pequena feita à mão (1 faixa, 2 peças) dá as posições esperadas, considerando serra e refilo
- Commit: `feat(core): tipos de domínio e geometria da árvore de cortes`

### Tarefa 0.3: Validador de plano (`core/validar.ts`)
- `validarPlano(plano, pecas, materiais, params)` → lista de erros. Verifica:
  - nenhuma peça sai da chapa (descontando os refilos)
  - não há sobreposição (incluindo a espessura da serra)
  - peça com `podeGirar=false` não está girada
  - profundidade ≤ `niveisMax`
  - cada peça aparece exatamente `quantidade` vezes
  - cada chapa contém só o seu material (exceto peça com material alternativo permitido)
- Testes: um caso válido e um caso inválido para cada regra
- Esse validador é o "juiz" usado pelos testes do otimizador e do `.prog`
- Commit: `feat(core): validador de plano de corte`

---

## Fase 1: Importador Promob (`packages/promob`)

### Tarefa 1.1: Parser do XML
- Dependência: `fast-xml-parser`
- `lerListagem(xml: string)` → `{ projeto: {guid, data, cliente: {nome, telefone, email}}, ambientes: [{descricao, itens: ItemPromob[]}] }`
- `ItemPromob` com os campos de [analise-xml-promob.md](analise-xml-promob.md): `uniqueId, descricao, grupo, idModelo, largura(WIDTH), altura(HEIGHT), profundidade(DEPTH), repeticao, rotacao(PLATECUTTINGROTATE), material(MATERIAL), modelo(MODEL), espessura(THICKNESS), fitas[1..4], corFita, uniqueIdsAgrupados`
- Precisa lidar com o BOM UTF-8 e com 1 ou N ambientes/itens (o parser devolve objeto ou array)
- Testes com `Everaldo cozinha.xml`: 1 ambiente, 42 itens, soma de `repeticao` = 76, cliente "Everaldo", item 9555 = 240×15×315, rep 3, rotação `N`, fita `[0,0,0,0.4]`
- Commit: `feat(promob): parser da listagem XML`

### Tarefa 1.2: Conversão para Peças
- `converter(listagem, config)` → `{ pecas: Peca[], pendencias: [...] }`:
  - `config.materiais`: casamento por `modelo` + `espessura`. O que não casar vira pendência `material-desconhecido` com a chave sugerida
  - `config.mapaGrupos`: grupo do Promob → tipo de peça
  - `config.origemPorTipo`: tipos marcados "gera pelo pro-cutter" são ignorados, com pendência `ignorado`
  - `config.ladosFita`: mapeamento dos lados 1 a 4 do Promob para as bordas da peça
  - medida = `largura` × `profundidade`; espessura = `altura`; `podeGirar = rotacao !== 'N' && !material.temVeio`
- Testes: cozinha com 2 materiais cadastrados dá 76 peças sem pendência (Branco 47 e Linho 29). Sem o Linho cadastrado, 18 linhas viram pendência. Grupo "Sarrafos" marcado como ignorado tira 8 linhas.
- Commit: `feat(promob): conversão de itens em peças com config da marcenaria`

---

## Fase 2: Formato `.prog` da CVL (`packages/cvl`)

### Tarefa 2.1: Leitor
- Portar [spikes/parse-prog.mjs](spikes/parse-prog.mjs) para TS: `lerProg(xml)` → `ChapaPlano` (árvore de `NoCorte`, com refilos em `refilo` e os marcadores `*` interpretados)
- Testes com os 5 `.prog` reais: número de peças por chapa (18, 15, 13, 18, 12) e medidas iguais às do spike. O conjunto das 5 chapas é igual às 76 peças do XML (por medida, ignorando material)
- Commit: `feat(cvl): leitor de .prog`

### Tarefa 2.2: Gerador
- `gerarProg(chapa, material, params)` → string XML idêntica ao estilo das amostras:
  - raiz `com.cutplanning.cvl.program` com `lenght` (grafia original), `width`, `thickness`, `material`, `quantity="1"`, `waste="0"`
  - cortes com `id` sequencial, `quantity`, `type`, `value` com `.0`, `waste="false"`
  - refilo `R<nível>` antes do primeiro corte de cada grupo: 5 em borda de fábrica, 1 em borda serrada
  - marcador `<nível>*` (`quantity=0`, `value=0.0`) na transição de peças finais para peças subdivididas, como nas amostras
  - tudo numa linha só, sem quebra
- Testes:
  - **ida e volta:** para cada `.prog` real, `gerarProg(lerProg(x))` precisa ser **byte a byte igual** a `x`. Se alguma regra (refilo ou marcador) não reproduzir exatamente, isso mostra onde a nossa interpretação está errada
  - propriedade com fast-check: árvore aleatória válida → gerar → ler → mesma árvore
- Commit: `feat(cvl): gerador de .prog com ida e volta byte a byte`

### Tarefa 2.3: Nome dos arquivos e verificação
- `nomeArquivo(projeto, material, seq)` → `<projeto>-<material>.<nnn>.prog` (seq com 3 dígitos, global no plano, sem caracteres inválidos em nome de arquivo)
- `verificarExportacao(plano, arquivos)`: relê cada arquivo e compara as peças com o plano. Qualquer divergência vira erro (é isso que bloqueia o download, decisão 18)
- Commit: `feat(cvl): nomes de arquivo e verificação pós-exportação`

---

## Fase 3: Otimizador (`packages/otimizador`)

### Tarefa 3.1: Construtiva por faixas (2 níveis)
- `otimizar(pecas, material, params, opcoes)` → `ChapaPlano[]`
- Heurística: expandir pela quantidade, ordenar por altura decrescente, montar **faixas `1Y`** (altura = maior peça da faixa) e preencher com **colunas `2X`** (first-fit decreasing). Chapa nova quando não couber.
- Respeitar serra, refilos e `podeGirar` (testar as duas orientações quando puder girar)
- Testes: `validarPlano` sem erros. Casos triviais: 1 peça, peça do tamanho exato útil, peça maior que a chapa (erro claro)
- Commit: `feat(otimizador): heurística construtiva em faixas`

### Tarefa 3.2: Terceiro nível
- Dentro de cada coluna `2X` com sobra vertical, empilhar peças em `2Y`; dentro de `2Y`, dividir em `3X`. Limitado por `niveisMax`.
- Testes: caso em que o 3º nível economiza uma chapa; com `niveisMax=2`, nenhuma árvore passa de `2X`
- Commit: `feat(otimizador): subdivisão até 3 níveis`

### Tarefa 3.3: Início por coluna (`1X`) e busca de melhoria
- Variante que começa em `1X` (colunas), como nas amostras 002, 003 e 005
- Busca com limite de tempo (padrão 5 s): várias ordenações (altura, área, maior lado, aleatória com semente) × início X/Y × alternativas de rotação. Fica com o plano de **menos chapas**; no empate, o de maior sobra útil contínua.
- Resultado determinístico para a mesma semente
- Testes de propriedade (fast-check, 200 casos aleatórios): `validarPlano` sempre vazio
- **Regressão com a cozinha do Everaldo:** ≤ 3 chapas de Branco e ≤ 2 de Linho Fendi (o mesmo resultado do software atual), com as chapas de cada material
- Commit: `feat(otimizador): início em colunas e busca de melhoria`

### Tarefa 3.4: Peças fixadas e material alternativo
- `opcoes.fixadas: {pecaId, chapaNumero}[]`: essas peças são alocadas primeiro na chapa indicada
- Peça com `materialAlternativo` pode entrar em sobra de outro material de mesma espessura, só depois de alocadas as peças próprias
- Testes para os dois casos com o validador
- Commit: `feat(otimizador): fixar peça em chapa e material alternativo`

### Tarefa 3.5: Métricas
- `metricas(plano)`: por chapa (área de peças, área da chapa, %, sobra útil, perda), por material e total do projeto, como em §8.1 do design. **Feito no `core`**, porque o visualizador e o relatório usam as métricas sem depender do otimizador
- Commit: `feat(otimizador): métricas de aproveitamento`

---

## Fase 4: Regras de porta e fundo (`packages/regras`)

### Tarefa 4.1: Avaliador de expressões restrito
- Parser próprio (descendente recursivo), **sem `eval`/`Function`**: números, variáveis, `+ - * / ( )`, `min`, `max`, `arred`, `piso`, `teto`. Erros com posição.
- Testes: precedência, divisão por zero → erro, variável desconhecida → erro, e tentativas de injeção (`constructor`, `__proto__`, `process`) → erro
- Commit: `feat(regras): avaliador de expressões seguro`

### Tarefa 4.2: Herança de regras
- `resolverRegras(config, projeto, modulo)`: merge Config → Projeto → Módulo, com o módulo guardando só os campos sobrescritos
- Testes de herança e de sobrescrita parcial
- Commit: `feat(regras): herança de regras em 3 níveis`

### Tarefa 4.3: Geração de peças por tipo de módulo
- `gerarPecas(modulo, tipoModulo, regras)`: para cada peça do tipo, avalia quantidade, comprimento e largura e monta a `Peca` (`origem: 'gerada'`, material, fita, `podeGirar`)
- Fórmulas padrão de fábrica para balcão, aéreo e torre (porta sobreposta 1 ou 2 folhas; fundo em canal ou sobreposto), em `padroes.ts`
- Testes em tabela (módulo + regras → peças esperadas)
- Commit: `feat(regras): geração de portas e fundos por fórmulas`

---

## Fase 5: Banco e autenticação

### Tarefa 5.1: Banco
- `docker-compose.yml` com `postgres:16`; `packages/db` com Prisma
- Schema conforme §4 do design: Empresa, Usuario, Configuracoes (JSON versionado para regras, fórmulas e importação), Material, Fita, Maquina, Cliente, Projeto, HistoricoStatus, Ambiente, Modulo, Peca, PlanoDeCorte, Chapa, PecaNoPlano
- **Todas as tabelas com `empresaId`** e índice. O helper `db.daEmpresa(empresaId)` aplica o filtro sempre.
- Seed: 1 empresa, 1 admin, materiais Branco 15 (2740×1840, sem veio) e Linho Fendi 15 (2750×1830, com veio), máquina CVL padrão, regras e fórmulas padrão
- Commit: `feat(db): schema, isolamento por empresa e seed`

### Tarefa 5.2: Next.js e autenticação
- `apps/web` com Next.js (App Router), Tailwind e shadcn/ui
- Auth.js (credenciais, e-mail e senha com hash `argon2`). A sessão carrega `usuarioId`, `empresaId` e `papel`.
- Middleware: rota sem sessão vai pro login; `/configuracoes` e `/usuarios` são só para `admin`
- Testes: login válido e inválido; usuário comum recebe 403 em rota admin
- Commit: `feat(web): app Next.js com login e papéis`

---

## Fase 6: Telas de cadastro

Cada tarefa inclui: rotas ou *server actions* com validação **zod**, tela, e testes de API (inclusive o isolamento entre empresas).

- **6.1 Usuários** (admin): listar, criar, editar, desativar, trocar papel e senha
- **6.2 Clientes:** nome e telefone, busca
- **6.3 Configurações** (admin), em abas:
  - Materiais e Fitas
  - Máquina
  - Regras padrão
  - Importação Promob (origem por tipo, mapa de grupos, lados da fita)
  - Etiqueta
- **6.4 Fórmulas** (admin): editor por tipo de módulo, validação com o avaliador e **prévia** com um módulo de exemplo
- **6.5 Projetos:** lista com filtro por status e cliente; criar (copia regras e fórmulas da empresa); trocar status com histórico

Um commit por tarefa.

---

## Fase 7: Projeto por dentro

- **7.1 Ambientes / importar XML:** upload, guardar o XML original, `promob.converter`, tela de pendências (cadastrar material na hora). Reimportar substitui só as peças `xml` do ambiente.
- **7.2 Módulos:** CRUD, edição de regras sobrescritas, geração e recálculo automático das peças `gerada`
- **7.3 Lista única de peças:** tabela agrupada por material, edição inline, peça avulsa, filtros por ambiente e origem. Qualquer alteração marca o plano como `desatualizado`.
- **7.4 Regras do projeto:** editar a cópia das regras e fórmulas. Ao salvar, recalcula as peças geradas.

---

## Fase 8: Plano de corte

- **8.1 Fila e worker:** `pg-boss` (fila no próprio Postgres). O job `otimizar(projetoId)` roda `otimizador` por material e grava PlanoDeCorte, Chapa e PecaNoPlano (nova versão). A tela consulta o progresso.
- **8.2 Visualizador** (design §8.1):
  - resumo (projeto e material)
  - miniaturas com %
  - chapa em SVG com zoom e arraste, cortes coloridos por nível, sobras útil e perda
  - modo sequência
  - clique na peça para ver detalhes e fixar
  - componentes recebem a saída de `core/geometria`
- **8.3 Fixar e reotimizar**

---

## Fase 9: Saídas (`packages/saidas` + downloads)

- **9.1 ZIP de `.prog`:** `cvl.gerarProg` por chapa, depois `cvl.verificarExportacao` (bloqueia se divergir), depois ZIP (`archiver`). Botão **Baixar ZIP**.
- **9.2 PDF desenho das chapas e sequência de cortes** (`pdfkit`, reaproveitando a geometria)
- **9.3 PDF de etiquetas** no tamanho configurado (padrão 100×50), com QR code (`qrcode`)
- **9.4 Relatório de material:** chapas por material, metros de fita por cor, aproveitamento e sobras (tela e PDF)

---

## Fase 10: Fechamento da v1

- **10.1** Teste ponta a ponta (Playwright): login, cliente, projeto, importar a cozinha, otimizar, ver o plano, baixar o ZIP. O ZIP precisa conter 5 `.prog` válidos.
- **10.2** README com como rodar (`docker compose up`, `npm run dev`) e como instalar na marcenaria
- **10.3** Validação na máquina real: importar um ZIP gerado no supervisório da CVL e cortar uma chapa de teste

---

## Riscos e como serão tratados

| Risco | Mitigação |
|---|---|
| Regra de marcador `*` ou de refilo interpretada errado | O teste de ida e volta byte a byte (2.2) acusa. Na dúvida, pedir mais amostras ou falar com a CVL antes da Fase 9 |
| Supervisório recusar o arquivo por algum detalhe | Tarefa 10.3 antecipada: assim que a 2.2 passar, gerar um `.prog` de teste pra importar na máquina |
| Otimizador pior que o software atual | Regressão com a cozinha (3.3). Mais amostras de projetos com `.prog` do software atual viram novos casos de regressão |
| Fórmulas padrão não batem com a marcenaria | São só o ponto de partida; tudo é editável (6.4), com prévia |
