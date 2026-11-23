# Brainstorm: decisões até agora

Projeto: **pro-cutter**, planejador de corte de chapas de MDF para marcenarias.

| # | Decisão | Origem |
|---|---|---|
| 1 | Entrada: listagem XML exportada do Promob (não o `.promob` nativo). Ver [analise-xml-promob.md](analise-xml-promob.md) | análise dos arquivos |
| 2 | Corte inicial em **seccionadora** (cortes guilhotina); CNC fica pra depois | usuário |
| 3 | O sistema tem **parametrização própria** para gerar portas e fundos, que se juntam às peças do XML num único plano de corte | usuário |
| 4 | Módulos (caixas) são informados no nosso sistema, porque o XML não liga as peças ao móvel (`UNIQUEPARENTID=-2`). Inferir módulos pelas peças fica como sugestão opcional | recomendação aceita |
| 5 | Regras de construção (folgas, tipo de porta, fundo etc.) são **preenchidas a cada projeto**, partindo de **padrões editáveis nas Configurações** | usuário |
| 6 | Herança em 3 níveis: **Configurações → Projeto → Módulo**. O projeto copia os padrões na criação; cada módulo herda do projeto e pode sobrescrever campos individuais | usuário |

| 7 | Plataforma **web** (navegador no escritório e tablet/celular perto da seccionadora), com servidor | usuário |

| 8 | Começa com **uma marcenaria**, mas todos os dados já separados por empresa (multi-tenant) pra virar SaaS sem reescrever | usuário |

| 9 | Saídas da v1: **desenho das chapas**, **sequência de cortes guilhotina**, **etiquetas por peça** e **relatório de material** (chapas, fita, aproveitamento, sobras) | usuário |

| 10 | Estoque de retalhos fica **pra depois**. A v1 só lista as sobras de cada plano no relatório | usuário |
| 11 | Parâmetros da seccionadora nas Configurações (padrão: espessura da serra 4 mm, refilo 10 mm por borda, sobra mínima útil 300×300 mm), ajustáveis no projeto | padrão assumido |

| 12 | Stack **TypeScript full-stack**: Next.js/React, Node, PostgreSQL | usuário |
| 13 | Máquina alvo: **seccionadora CVL Máxima** (supervisório Java em Linux). Integração por **exportação de `.prog`**, um arquivo por chapa, com o plano já otimizado pelo nosso sistema. Formato decifrado e validado em [analise-prog-cvl.md](analise-prog-cvl.md) | usuário + análise |
| 14 | Saídas por **exportadores plugáveis** (Máquina → Exportador nas Configurações); o primeiro é o `.prog` CVL | recomendação |
| 15 | O tamanho da chapa fica no **Material** (varia por fornecedor: Branco 2740×1840, Linho Fendi 2750×1830) | análise |
| 17 | Otimizador guilhotina em até **3 níveis** (`1X→1Y→2X→2Y→3X`), configurável na Máquina; veio respeitado; sem misturar materiais (exceção só se for marcada explicitamente por peça) | usuário |
| 18 | Todo `.prog` gerado é relido pelo parser e precisa bater 100% com o plano antes do download | recomendação aceita |
| 19 | Etiqueta térmica com tamanho configurável, padrão **100×50 mm** | padrão assumido |
| 20 | Um Projeto do pro-cutter tem **vários Ambientes**, cada um normalmente vindo de um XML do Promob. O plano de corte **junta as peças de todos os ambientes** | usuário |
| 21 | Cadastro de **Cliente** simples: nome e telefone | usuário |
| 22 | **Status do projeto**: Orçamento → Aprovado → Em corte → Cortado → Entregue, mais Cancelado, com histórico | usuário |
| 23 | **Usuários** com dois papéis: **Admin** (usuários e configurações) e **Usuário** (o resto) | usuário |
| 24 | **Fórmulas** de porta e fundo configuráveis por marcenaria, por tipo de módulo (avaliador de expressões restrito, com prévia) | usuário |
| 25 | **Origem de portas e fundos** (Promob ou pro-cutter), mapeamento de grupos e **lados da fita** configuráveis na importação | usuário |
| 26 | **Visualizador de chapas** com cortes por nível, sequência passo a passo e **aproveitamento por chapa, por material e do projeto** | usuário |
| 16 | Entrega dos `.prog`: hoje o PC da máquina lê uma **pasta compartilhada na rede**. A v1 tem um botão **"Baixar ZIP"** com os `.prog` do plano; o usuário salva na pasta. Agente de entrega automática fica pra depois | usuário |

## Em aberto

- Validação do design por seções
- Parâmetros da seccionadora (espessura da serra, refilo, sobras)
