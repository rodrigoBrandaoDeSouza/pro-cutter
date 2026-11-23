# Análise do formato `.prog` (seccionadora CVL Máxima)

## A máquina

- **Seccionadora CVL Máquinas, linha Máxima**
- Software: *Supervisório/Gerenciador de Corte CVL Máxima* v0.0.2b01.5 (14/10/2022), da CVL Máquinas Ltda, exclusivo da linha Máxima
- Roda em Linux (kernel 4.4 el6, ou seja, CentOS/RHEL 6) com Java 1.8.0_221
- Importa arquivos `.prog`, gerados hoje por outro software de planejamento de corte

## Amostras

5 arquivos gerados a partir de `Everaldo cozinha.xml`, **um arquivo por chapa**:

```
Everaldo cozinha.xml-MDF Branco 15mm.001.prog
Everaldo cozinha.xml-MDF Branco 15mm.002.prog
Everaldo cozinha.xml-MDF Branco 15mm.003.prog
Everaldo cozinha.xml-MDF Fibraplac.Conceito.Linho Fendi 15mm.004.prog
Everaldo cozinha.xml-MDF Fibraplac.Conceito.Linho Fendi 15mm.005.prog
```

Padrão do nome: `<arquivo de origem>-<descrição do material>.<nº sequencial global de 3 dígitos>.prog`.

## Estrutura

XML sem quebra de linha, em ASCII/UTF-8. O nome dos elementos vem de serialização Java (`com.cutplanning.cvl...`).

```xml
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<com.cutplanning.cvl.program lenght="2740.0" width="1840.0" thickness="15.0"
    material="MDF-15-Branco-MDF Branco 15mm" quantity="1" waste="0">
  <com.cutplanning.cvl.program.cut id="1" quantity="1" type="R1Y" value="5.0" waste="false"/>
  <com.cutplanning.cvl.program.cut id="2" quantity="1" type="1Y"  value="550.0" waste="false"/>
  ...
</com.cutplanning.cvl.program>
```

### Raiz (`program`) = uma chapa

| Atributo | Significado |
|---|---|
| `lenght` (com erro de grafia, **manter assim**) | Comprimento da chapa (eixo X), mm |
| `width` | Largura da chapa (eixo Y), mm |
| `thickness` | Espessura, mm |
| `material` | `MDF-<esp>-<cor>-<descrição>`. Provavelmente só texto exibido |
| `quantity` | Quantas chapas iguais cortar com esse padrão (hipótese, todas as amostras = 1) |
| `waste` | Sempre `0` nas amostras |

Os tamanhos de chapa **variam por material**: Branco 2740×1840 e Linho Fendi 2750×1830. Então o tamanho da chapa tem que ficar no cadastro do Material.

### Cortes (`program.cut`), em sequência

`id` sequencial; `value` em mm; `quantity` = repetições do mesmo corte; `waste` sempre `false` nas amostras.

O `type` segue uma **escada fixa de níveis de corte guilhotina**, alternando os eixos:

```
1X → 1Y → 2X → 2Y → 3X → (3Y...)
```

- `1X`: corta uma **coluna** da chapa no eixo X (valor = comprimento da coluna)
- `1Y`: corta uma **faixa** dentro da coluna (valor = largura da faixa)
- `2X`: divide a faixa no eixo X
- `2Y`: divide no eixo Y
- `3X`: divide no eixo X, e assim por diante

Se o plano começa em `1Y`, a chapa inteira é a coluna `1X` implícita. Isso é o comum: faixas no sentido do comprimento.

Tipos especiais:

| Tipo | Significado |
|---|---|
| `R<nível>` (ex.: `R1Y`, `R2X`) | **Refilo** antes dos cortes daquele nível. Vale **5 mm** quando a borda é a de fábrica da chapa e **1 mm** quando a borda já é de corte de serra (re-esquadrejamento) |
| `<nível>*` com `value=0`, `quantity=0` (ex.: `2Y*`, `3X*`) | **Marcador de modo**: a partir dele, as próximas peças do nível anterior passam a ser subdivididas nesse nível. As peças anteriores ao marcador são peças finais. Ex.: `2X:2180 2Y*:0 2X:150 R2Y:1 2Y:550` quer dizer que a coluna 2180 é peça inteira e a coluna 150 é subdividida em 550 |

### Exemplo decodificado (chapa 004, Linho Fendi 2750×1830)

```
R1Y 5           refilo da borda de fábrica
1Y 710          faixa de 710
  R2X 5           refilo da ponta
  2X 2180         peça 2180×710   (Lateral)
  2Y*             a partir daqui, colunas são subdivididas
  2X 150          coluna 150
    R2Y 1
    2Y 550          peça 150×550  (Base)
    3X*             a partir daqui, faixas são subdivididas
    2Y 70           faixa 70
      R3X 1
      3X 120          peça 120×70 (Sarrafo)
  ...
```

## Validação

O parser [spikes/parse-prog.mjs](spikes/parse-prog.mjs) reconstrói a árvore de cortes e compara as peças com o XML do Promob.

- **76 de 76 peças** reconstruídas com as medidas corretas
- Única diferença: um sarrafo **Branco** de 120×70 foi cortado na chapa de **Linho Fendi**. Isso foi escolha (ou erro) do software que gerou os arquivos; o formato não tem relação com isso. Talvez o software aproveite cor diferente em sarrafo oculto. **Perguntar.**

## O que NÃO vem no `.prog`

- **Identificação das peças** (nome, cliente, módulo): só tem medidas. Etiquetas e relatório precisam vir do nosso sistema, casando com a ordem dos cortes
- **Espessura da serra**: a máquina aplica a dela. O plano só precisa garantir que a soma das peças + serras + refilos cabe na chapa
- Fita de borda e veio

## Dúvidas para confirmar com a CVL ou com mais amostras

1. Profundidade máxima de níveis aceita (vimos até `3X`)
2. `quantity > 1` em corte e em `program`: a máquina repete sozinha?
3. Para que serve `waste`: marcar sobras aproveitáveis?
4. O supervisório exige o padrão de nome do arquivo ou só a extensão?
5. Como os arquivos chegam na máquina hoje: pendrive, pasta de rede?

## Confirmações da implementação (23/11/2026)

- **Ida e volta byte a byte:** as 5 amostras lidas e regeneradas pelo `packages/cvl` saem idênticas ao original. Isso confirma as regras:
  - refilo `R<nível>` antes do primeiro nó de cada grupo
  - marcador `<nível>*` antes do primeiro nó subdividido que vem depois de peças finais no mesmo grupo
  - peças finais sempre antes dos nós subdivididos
- **Espessura da serra:** as 5 chapas só cabem com serra de **até 5,0 mm**. A chapa 001 é a limitante: estoura com 5,1 mm. O software atual usa algo ≤ 5 mm.
- **Orientação:** o `WIDTH` do Promob vai no eixo X (`lenght`) do `.prog`. Peças com veio (Linho Fendi) nunca aparecem giradas; peças sem veio (Branco) aparecem.
