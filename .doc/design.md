# pro-cutter: Design da v1

> Planejador de corte de chapas de MDF para marcenarias. Importa as listagens do Promob, gera portas e fundos por regras próprias, otimiza o corte para seccionadora e exporta os programas da **CVL Máxima**.
>
> Data: 23/11/2026 · Origem: brainstorm ([brainstorm-decisoes.md](brainstorm-decisoes.md)) · Análises: [analise-xml-promob.md](analise-xml-promob.md), [analise-prog-cvl.md](analise-prog-cvl.md)

## 1. Objetivo

Transformar os projetos feitos no Promob num plano de corte único por projeto, pronto pra seccionadora. O plano cobre:

- as peças que o Promob exporta (caixas: bases, laterais, sarrafos)
- as portas e fundos gerados por regras configuráveis da marcenaria
- peças avulsas

E entrega:

- os arquivos `.prog` da CVL
- o desenho das chapas
- a sequência de cortes
- as etiquetas das peças
- o relatório de material

## 2. Contexto e restrições

- **Entrada:** listagem XML do Promob ("Listagem-Montado"). O `.promob` nativo **não** é usado, porque as peças dependem das bibliotecas do Promob.
- **Máquina:** seccionadora CVL Máxima, com supervisório em Java num Linux (CentOS 6). Ela importa `.prog`, um arquivo por chapa, de uma **pasta compartilhada na rede**.
- **Plataforma:** web. Começa com uma marcenaria, mas todos os dados têm `empresaId` desde o início pra virar SaaS sem reescrever.
- **Stack:** TypeScript full-stack: Next.js (React + rotas de API), PostgreSQL com Prisma, worker de otimização em Node.

## 3. Fluxo principal

```
Cliente ─┐
         ▼
      Projeto (status) ──► Ambientes ◄── importar XML do Promob (1 por ambiente)
         │                   │
         │                   ├─ Peças importadas (xml)
         │                   ├─ Módulos ─► regras herdadas ─► Peças geradas (portas, fundos)
         │                   └─ Peças avulsas (manual)
         ▼
   Lista única de peças do projeto (todas as origens, agrupadas por material)
         ▼
   Otimizar ──► Plano de corte (versão) ──► árvore de cortes por chapa
         ▼
   Saídas: ZIP de .prog · desenho das chapas (PDF) · sequência de cortes · etiquetas (PDF) · relatório de material
```

## 4. Modelo de dados

Toda tabela tem `empresaId`. Campos principais:

| Entidade | Campos |
|---|---|
| **Empresa** | nome |
| **Usuário** | nome, e-mail (login), senha (hash), papel: `admin` \| `usuario`, ativo |
| **Configurações** (1 por empresa) | regras padrão (§5), parâmetros de corte padrão, tamanho da etiqueta (padrão 100×50 mm) |
| **Material** | cor/descrição, espessura, tamanho da chapa (C×L), tem veio (s/n), chaves de casamento com o Promob (`REFERENCES/MODEL` + `THICKNESS`), ativo |
| **Fita** | cor, espessura (ex.: 0,4 mm), material associado (opcional) |
| **Máquina** | nome, exportador (`cvl-prog`), espessura da serra, refilo de borda de fábrica (5 mm), refilo de borda serrada (1 mm), níveis máximos (3), sobra mínima útil (300×300) |
| **Cliente** | nome, telefone |
| **Projeto** | cliente, nome, status, regras (cópia das Configurações na criação, editável), máquina, observações |
| **HistóricoStatus** | projeto, de → para, usuário, data |
| **Ambiente** | projeto, nome (ex.: "Cozinha"), arquivo XML original (guardado), data da importação |
| **Módulo** | ambiente, nome, tipo (balcão, aéreo, torre, gaveteiro...), L×A×P, nº de portas, material da caixa, material da porta, regras sobrescritas (só os campos alterados) |
| **Peça** | ambiente, módulo (opcional), origem `xml` \| `gerada` \| `manual`, nome, comprimento × largura, espessura, quantidade, material, fita lados 1 a 4, pode girar, id de origem no Promob (`UNIQUEID`), permitir material alternativo (s/n) |
| **PlanoDeCorte** | projeto, versão, máquina, parâmetros usados, criado por/em, status: `atual` \| `desatualizado` |
| **Chapa** (do plano) | plano, material, nº sequencial, tamanho, árvore de cortes (JSON), aproveitamento % |
| **PeçaNoPlano** | chapa, peça, posição x/y, girada, nº da etiqueta |

**Status do projeto:** `Orçamento → Aprovado → Em corte → Cortado → Entregue`, mais `Cancelado`. O usuário pode avançar ou voltar livremente, e cada troca fica no histórico.

## 5. Regras de construção (portas e fundos)

A herança tem três níveis: **Configurações → Projeto → Módulo**.

- O Projeto **copia** as regras das Configurações na criação. Mudanças posteriores nas Configurações não afetam projetos que já existem.
- O Módulo herda do Projeto e guarda **só os campos sobrescritos**.

Regras da v1:

| Grupo | Campos |
|---|---|
| Porta | tipo (sobreposta \| embutida), folga externa, folga entre portas, sobreposição na lateral, fita (lados) |
| Fundo | espessura (3/6 mm), montagem (canal \| sobreposto), profundidade do canal, folga |
| Fita padrão | lados com fita por tipo de peça (porta, fundo) |

Peças `gerada` ficam ligadas ao módulo e **são recalculadas** quando o módulo ou as regras mudam. Peças `xml` e `manual` nunca são recalculadas automaticamente. Reimportar o XML de um ambiente substitui só as peças `xml` daquele ambiente.

### Fórmulas configuráveis por marcenaria

As fórmulas de porta e fundo **não ficam fixas no código**. Cada marcenaria edita as suas em *Configurações → Fórmulas*, por **tipo de módulo** (balcão, aéreo, torre...). O sistema já vem com fórmulas padrão.

- Cada tipo de módulo define as **peças que gera** (ex.: "Porta", "Fundo"), com fórmulas para quantidade, comprimento e largura, além de material, fita e se gira.
- As fórmulas usam variáveis do módulo e das regras: `L`, `A`, `P` (medidas do módulo), `esp` (espessura da caixa), `nPortas`, `folgaExt`, `folgaEntre`, `sobrepos`, `espFundo`, `canal`... Ex.: largura da porta = `(L - 2*folgaExt - (nPortas-1)*folgaEntre) / nPortas`.
- Para segurança, as expressões são interpretadas por um avaliador matemático restrito (só aritmética, `min`, `max`, `arred`), nunca executadas como código.
- A tela de fórmulas mostra uma **prévia**: digita um módulo de exemplo e vê as peças resultantes.
- Os projetos copiam as fórmulas junto com as regras na criação. Mudar as Configurações não altera projetos existentes.

## 6. Importação do Promob

Detalhes em [analise-xml-promob.md](analise-xml-promob.md).

- Cada `ITEM` vira uma Peça: `WIDTH`×`DEPTH` = medida, `HEIGHT` = espessura, quantidade = `REPETITION` (**não** `QUANTITY`, que é área em m²).
- O material é casado por `REFERENCES/MODEL` + `THICKNESS`. Se não existir no cadastro, a importação pergunta e permite cadastrar ali mesmo.
- `PLATECUTTINGROTATE="N"` quer dizer que a peça não gira; `NONE` quer dizer que gira. O padrão do Material (tem veio) prevalece quando o XML não diz.
- `FITA_BORDA_1..4`: espessura da fita por lado (0 = sem fita). Cor da fita em `MODEL_DESCRIPTION_FITA`.
- Os dados do cliente no XML (`CUSTOMERSDATA`) servem como sugestão ao criar o Cliente.

### Configurações de importação (por marcenaria)

Ainda não sabemos o que cada listagem do Promob traz, então isso fica configurável:

- **Origem por tipo de peça:** para portas, fundos (e outros tipos que surgirem), escolher **"vem do Promob"** ou **"gera pelo pro-cutter"**. Isso evita peça duplicada quando a listagem já traz portas e fundos. Itens do XML cujo grupo está marcado como "gera pelo pro-cutter" são ignorados na importação, com aviso.
- **Mapeamento dos grupos do Promob** (`GROUP`/`ID` do item, ex.: "Bases", "Laterais/Divisórias", "Sarrafos") para os tipos de peça do pro-cutter.
- **Convenção dos lados da fita:** qual lado (1 a 4) do Promob corresponde a qual borda da peça (comprimento superior/inferior, largura esquerda/direita). Vem com um padrão e é ajustável.

## 7. Otimizador

- **Escopo:** todas as peças do projeto (todos os ambientes), agrupadas por material. Cada material é otimizado de forma independente.
- **Modelo:** guilhotina em níveis igual à CVL: `1X → 1Y → 2X → 2Y → 3X`, no máximo **3 níveis** (configurável na Máquina).
- **Considera:** espessura da serra, refilo de 5 mm na borda de fábrica e de 1 mm na borda serrada, tamanho da chapa do Material.
- **Restrições:** peça com veio não gira. Não mistura materiais, salvo peça marcada "permitir material alternativo".
- **Estratégia:** heurística construtiva (faixas → colunas → subdivisões) mais uma busca de melhoria com tempo limitado. A busca testa ordenações e se a chapa começa em `1X` ou `1Y`, e escolhe o maior aproveitamento.
- **Ajuste manual na v1:** fixar uma peça numa chapa e reotimizar o restante.
- Roda num **worker** (fila). A tela acompanha o progresso.
- **Versão do plano:** cada otimização cria uma nova versão. Alterar peças marca o plano atual como `desatualizado`.

## 8. Saídas

Todas saem da mesma árvore de cortes.

| Saída | Detalhe |
|---|---|
| **ZIP de `.prog`** | Um `.prog` por chapa, nome `<projeto>-<material>.<nnn>.prog`, formato em [analise-prog-cvl.md](analise-prog-cvl.md) (incluindo o atributo `lenght` com a grafia original). **Antes do download, cada arquivo é relido pelo parser e precisa reconstruir 100% das peças do plano**; se não bater, o download é bloqueado |
| **Visualizador de chapas** | Ver §8.1 |
| **Desenho das chapas** | PDF: peças numeradas, medidas, fita nas bordas, indicação de veio, sobras |
| **Sequência de cortes** | Passo a passo na ordem do `.prog`, por chapa |
| **Etiquetas** | PDF no tamanho configurado: cliente, projeto, ambiente, módulo, peça, medida, lados com fita, nº da chapa/peça e QR code com o id da peça |
| **Relatório de material** | Chapas por material, metros de fita por cor, aproveitamento %, sobras acima do mínimo útil |

### 8.1 Visualizador de chapas

Tela principal da aba *Plano de corte*:

- **Resumo do projeto** no topo:
  - aproveitamento total do projeto, e também por material
  - nº de chapas por material
  - m² de peças contra m² de chapa
  - m² de sobra útil e de perda
- **Lista ou miniaturas das chapas**, cada uma com nº, material e **aproveitamento %**, com cor indicando faixa (ex.: < 70% em alerta).
- **Chapa em detalhe** (SVG, com zoom e arraste, funciona em tablet):
  - peças desenhadas na escala, com nº e medida; fita nas bordas e veio indicados
  - **linhas de corte** por nível (`1X`/`1Y`/`2X`/`2Y`/`3X`) com cor e espessura diferentes, e refilos
  - sobras em hachura: útil (≥ sobra mínima) diferente de perda
  - **modo sequência:** avança corte a corte, destacando o corte atual e a lista lateral (a mesma ordem do `.prog`)
  - clique na peça: ambiente, módulo, nome, medida, fita, e a opção de fixar nesta chapa
- **Cálculo:** aproveitamento da chapa = área das peças ÷ área da chapa. O do projeto é a soma das áreas das peças ÷ a soma das áreas das chapas.

## 9. Interface

**Diretriz: visual moderno e fácil de usar.**

- Base em **shadcn/ui + Tailwind**: componentes limpos e acessíveis, tema claro e escuro, tipografia Inter
- Navegação lateral enxuta (Projetos, Clientes, Configurações, Usuários). O projeto abre com abas e um cabeçalho fixo que mostra cliente, status e ação principal
- **Uma ação principal por tela**, em destaque ("Importar XML", "Otimizar", "Baixar ZIP"); o resto vai em menus secundários
- Status com cores (badges), aproveitamento com barra e cor, estados vazios com orientação ("Importe o XML do Promob para começar")
- Importação por **arrastar e soltar**, edição inline nas tabelas, atalhos de teclado nas listas, toasts de confirmação, nada de recarregar a página
- Responsivo: o visualizador e os downloads funcionam bem em **tablet**, perto da máquina

## 9.1 Telas da v1

1. **Login**
2. **Projetos:** lista com filtro por status e cliente. Criar projeto escolhendo ou criando o cliente
3. **Projeto:**
   - abas *Ambientes* (importar XML, módulos, peças), *Peças* (lista única editável), *Plano de corte* (otimizar, visualizar, fixar peça, downloads), *Regras* (do projeto)
   - troca de status com histórico
4. **Clientes:** cadastro simples (nome, telefone)
5. **Configurações** (admin): materiais, fitas, máquina, regras padrão, **fórmulas por tipo de módulo** (com prévia), **importação do Promob** (origem por tipo de peça, mapeamento de grupos, lados da fita), etiqueta
6. **Usuários** (admin): criar, editar, desativar, papel `admin`/`usuario`

## 10. Arquitetura

```
Navegador ──► Next.js (apps/web: telas + API + auth)
                 ├── PostgreSQL (Prisma), tudo com empresaId
                 ├── Fila de otimização ──► worker (packages/otimizador)
                 └── Armazenamento de arquivos (XMLs, PDFs, ZIPs)
```

Monorepo:

| Pacote | Responsabilidade |
|---|---|
| `apps/web` | Telas, API, autenticação, permissões |
| `packages/promob` | Parser e importador do XML do Promob |
| `packages/regras` | Geração de portas e fundos a partir de Módulo + regras herdadas |
| `packages/otimizador` | Corte guilhotina em níveis; TypeScript puro, sem web nem banco |
| `packages/exportadores` | `.prog` CVL (gerar e reler/validar), PDFs (desenho, sequência, etiquetas), relatório |

## 11. Testes

- **Importador:** `Everaldo cozinha.xml` precisa dar 76 peças, com material, veio e fita corretos.
- **Exportador `.prog`:**
  - ida e volta (gerar → reler → mesmas peças)
  - os 5 `.prog` reais de `.doc/models/` precisam ser lidos e bater com o XML
- **Otimizador:** testes de propriedade com entradas aleatórias. Nunca pode haver sobreposição, peça fora da chapa, peça com veio girada, mais de 3 níveis ou corte que não seja guilhotina. Mais o caso real da cozinha como regressão de aproveitamento.
- **Regras:** tabela de casos (módulo + regras → portas/fundos esperados), validada com a marcenaria.
- **Permissões:** usuário comum não acessa Configurações nem Usuários. Dados de uma empresa nunca aparecem pra outra.

## 12. Fora da v1

- Estoque de retalhos
- Agente de entrega automática na máquina
- Editor livre de arrastar peças
- Inferência automática de módulos a partir das peças
- CNC
- SaaS com várias empresas ativas (cadastro público, cobrança)

## 13. Pontos em aberto

1. ~~Fórmulas de porta e fundo~~: **resolvido**, configuráveis por marcenaria (§5). Falta só definir as fórmulas padrão que vêm de fábrica
2. CVL:
   - significado de `quantity > 1` e `waste`
   - se o nome do arquivo importa
   - níveis máximos reais da máquina
3. Sarrafo Branco cortado em chapa Linho Fendi nas amostras: o usuário vai trazer mais amostras. Até lá, "permitir material alternativo" fica na v1 como opção por peça, desligada por padrão
4. Promob: a convenção dos lados da fita e a origem de portas e fundos ficam **configuráveis** (§6). Mais amostras de XML vão ajudar a escolher os padrões
