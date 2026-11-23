# Análise do XML de exemplo (Promob)

Arquivo: `.doc/models/Everaldo cozinha.xml` (exportação "Listagem-Montado" do Promob Plus Professional 5.60.50, 19/11/2026).

## Estrutura

```
LISTING (UNIT="MM", DATE, HOUR)
├─ PROJECTGUID
├─ ABOUTPROMOB / LIBRARIES        (versão do Promob e bibliotecas, irrelevante pro corte)
├─ CUSTOMERSDATA / DATA[ID,VALUE] (cliente: nome, telefone, e-mail, ambiente, situação)
└─ AMBIENTS / AMBIENT             ("Projeto - cozinha Everaldo Gobbi")
   ├─ CATEGORIES / CATEGORY ("Cozinhas") / ITEMS / ITEM ×42
   │    ├─ atributos (dimensões, repetição, rotação...)
   │    ├─ REFERENCES/*  (material, espessura, fitas, chapa...)
   │    └─ METADATAS/METADATA UniqueIdCollection (ids das peças agrupadas)
   └─ MODELINFORMATIONS          (acabamentos escolhidos por "caixa", fita...)
```

## Campos úteis por peça (ITEM)

| Campo | Exemplo | Significado |
|---|---|---|
| `DESCRIPTION` / `GROUP` | Base 15 / Bases | Nome e tipo da peça (Bases, Laterais/Divisórias, Sarrafos) |
| `WIDTH` × `DEPTH` | 240 × 315 | **Dimensões de corte** (mm) |
| `HEIGHT` | 15 | Espessura (confirmado por `REFERENCES/THICKNESS`) |
| `REPETITION` | 3 | **Quantidade de peças iguais** (bate com `UniqueIdCollection`) |
| `QUANTITY` + `UNIT="M2"` | 0.08 | Área de **uma** peça em m², arredondada. Não é contagem |
| `PLATECUTTINGROTATE` | `N` / `NONE` | `N` = não pode girar (veio/textura, ex.: Linho Fendi); `NONE` = pode girar (Branco) |
| `REFERENCES/MODEL` | Fibraplac.Conceito.Linho Fendi | **Material/acabamento** (agrupa as peças por chapa) |
| `REFERENCES/MATERIAL` | MDF | Tipo de chapa |
| `REFERENCES/FITA_BORDA_1..4` | 0 / 0.4 | Fita de borda por lado (0 = sem fita; 0.4 = espessura em mm) |
| `REFERENCES/MODEL_DESCRIPTION_FITA` | Linho Fendi | Cor da fita |
| `REFERENCES/MAXWIDTH` × `MAXDEPTH` | 2750 × 1830 | Tamanho da chapa padrão |
| `REFERENCES/LARGURA_CHAPA` / `ALTURA_CHAPA` | `YYY` / `OOO` | Placeholders não preenchidos (não usar) |
| `UNIQUEID` | 9555 | Id da peça no projeto |

## Números deste projeto

- 42 linhas → **76 peças**, todas MDF 15 mm, todas retangulares
- **Branco:** 47 peças, 12,48 m² (≈ 2,5 chapas sem contar perda), podem girar
- **Linho Fendi (Fibraplac):** 29 peças, 7,26 m² (≈ 1,5 chapas), **não podem girar**
- Fitas: Bases têm fita só no lado 4, Laterais só no lado 2, Sarrafos sem fita

## O que NÃO vem no XML

- Furação/usinagem e peças não retangulares (`SHAPE` vazio)
- Preços (`TOTALPRICES` vazio)
- Só peças de caixa (bases, laterais, sarrafos): nada de portas, frentes, fundos (3 mm) nem tampos. Ou é um filtro da exportação ou o projeto só tem isso
- Qual lado é o 1, 2, 3 ou 4 da fita (falta confirmar a convenção do Promob)
- `AMBIENTS="3\0"` no cabeçalho, mas só 1 ambiente veio no arquivo

## Arquivos nativos `.promob` / `.bak`

`angela.promob` e `angela.bak` são ZIPs do projeto nativo (Promob Plus 5.37, salvos em 09/06/2022). O `.bak` é só uma versão salva 9 minutos antes, com 24 entidades contra 29 no `.promob`.

O ZIP contém:

- `promob.info`: versão do Promob e histórico de gravação
- `sugestao.jpg`: render/miniatura do projeto
- `solucao/document1/document1.dataclient`: **só a definição** dos campos do cliente (nome, CPF/CNPJ, endereço...), sem valores
- `solucao/container1/document1/document1.ambient3d`: **a cena 3D em XML**. É uma árvore de entidades (ambiente → móvel → peças) com:
  - `INSERTDIMENSION` (L×A×P) de cada entidade, ex.: armário 2400×2500×620 com peças de 18 mm (laterais 18×2500×620, base/tampo 2364×18×620) e fundos de 3 mm (776×2384×3)
  - atributos globais do ambiente: espessura e material padrão por tipo de peça (`COZ_ESP_LAT=15`, `COZ_ESP_FUN=6`, `COZ_MAT_*=MDF`...)
  - referência ao modelo da biblioteca (`dor_mod_caixas`, `sal_mod_caixas`), posição, rotação, furos (`HOLE`)

**Conclusão:** o `.promob` não serve como entrada do plano de corte. Quase todas as peças vêm sem nome, sem referência de material/cor, sem fita e sem regra de veio. Essas informações vivem nas **bibliotecas do Promob**, que não estão no arquivo, e quem "explode" o móvel em peças é o próprio Promob. A entrada certa é a **listagem XML exportada** (como `Everaldo cozinha.xml`), que já sai com tudo resolvido.

## Dúvidas para confirmar

1. `REPETITION` é mesmo a quantidade a cortar? (hipótese forte, bate com os ids agrupados)
2. Qual é a convenção dos lados 1 a 4 da fita (relativo a WIDTH/DEPTH)?
3. Portas e fundos saem em outra listagem/XML?
