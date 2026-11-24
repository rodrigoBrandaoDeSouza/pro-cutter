# Instalação do pro-cutter na marcenaria

O pro-cutter roda num computador da marcenaria (o "servidor") e é acessado pelo navegador de qualquer
PC, tablet ou celular da mesma rede. O banco de dados fica nesse mesmo computador.

## 1. O que precisa

- Um computador que fique ligado no horário de trabalho (Windows 10/11, Linux ou macOS), com pelo
  menos 4 GB de RAM e 10 GB livres.
- **Docker** instalado:
  - Windows ou macOS: [Docker Desktop](https://www.docker.com/products/docker-desktop/). Em
    _Settings › General_, marque “Start Docker Desktop when you sign in”.
  - Linux: Docker Engine com o plugin `docker compose`.
- Internet na primeira instalação (para baixar as imagens).

## 2. Instalar

1. Copie a pasta do pro-cutter para o servidor (por exemplo `C:\pro-cutter`).
2. Na pasta, copie `.env.producao.example` para `.env.producao` e ajuste:

   | Variável           | O que é                                                                     |
   | ------------------ | --------------------------------------------------------------------------- |
   | `POSTGRES_SENHA`   | Senha do banco. Invente uma longa; ninguém precisa digitá-la.               |
   | `SEED_EMPRESA`     | Nome da marcenaria.                                                         |
   | `SEED_ADMIN_EMAIL` | E-mail do administrador.                                                    |
   | `SEED_ADMIN_SENHA` | Senha inicial do administrador (o app pede para trocar no primeiro acesso). |
   | `PORTA`            | Porta de acesso (padrão 3000).                                              |

3. Abra um terminal na pasta e rode:

   ```bash
   docker compose -f docker-compose.producao.yml --env-file .env.producao up -d --build
   ```

   A primeira vez leva alguns minutos. O app cria as tabelas e a marcenaria sozinho. Depois disso ele
   sobe junto com o Docker sempre que o computador ligar.

4. Descubra o IP do servidor na rede (Windows: `ipconfig`, procure “Endereço IPv4”) e acesse de
   qualquer aparelho: **`http://IP-DO-SERVIDOR:3000`**.

> Dica: peça para fixar o IP do servidor no roteador. Assim o endereço não muda.

## 3. Primeiro acesso

1. Entre com o e-mail e a senha do `.env.producao` e **troque a senha** (o aviso aparece no topo).
2. Em **Configurações**:
   - **Materiais:** confira as chapas (tamanho real, veio) e as chaves do Promob. Na primeira
     importação de cada cor, o pro-cutter pergunta e grava a chave sozinho.
   - **Máquina:** informe a **espessura real da serra** e os refilos da seccionadora.
   - **Regras** e **Fórmulas:** folgas de porta e fundo usadas na marcenaria.
   - **Importação:** se a listagem do Promob já traz portas e fundos, marque “Vem do Promob” para não
     duplicar.
   - **Etiqueta:** tamanho da etiqueta da impressora térmica.
3. Em **Usuários**, cadastre as pessoas. Cada uma troca a senha no primeiro acesso.

## 4. Levar o corte para a seccionadora (CVL Máxima)

1. No projeto, aba **Plano de corte**, clique em **Baixar ZIP (CVL)**.
2. Descompacte o ZIP na **pasta compartilhada** que o computador da seccionadora lê.
3. No Supervisório da CVL, abra os arquivos `.prog` (um por chapa, na ordem 001, 002…).

As etiquetas (PDF) imprimem uma por peça na ordem das chapas; o número da etiqueta é o mesmo do desenho.

## 5. Backup

O que importa está no banco. Faça cópia **pelo menos uma vez por semana** e guarde fora do servidor
(pendrive, nuvem). Os comandos abaixo funcionam igual no PowerShell, no cmd e no Linux:

```bash
docker compose -f docker-compose.producao.yml --env-file .env.producao exec banco pg_dump -U procutter -Fc -f /tmp/backup.dump procutter
docker compose -f docker-compose.producao.yml --env-file .env.producao cp banco:/tmp/backup.dump ./backup-AAAA-MM-DD.dump
```

Para restaurar (num servidor novo, com o pro-cutter já instalado):

```bash
docker compose -f docker-compose.producao.yml --env-file .env.producao cp ./backup-AAAA-MM-DD.dump banco:/tmp/restaurar.dump
docker compose -f docker-compose.producao.yml --env-file .env.producao exec banco pg_restore -U procutter -d procutter --clean --if-exists /tmp/restaurar.dump
```

> Não use `pg_dump ... > arquivo.sql` no PowerShell: ele grava em UTF-16 e o arquivo não restaura.

## 6. Atualizar

Copie a versão nova por cima da pasta (mantendo o `.env.producao`) e rode de novo:

```bash
docker compose -f docker-compose.producao.yml --env-file .env.producao up -d --build
```

As atualizações do banco são aplicadas sozinhas na inicialização. Faça um backup antes.

## 7. Problemas comuns

| Sintoma                                                             | O que fazer                                                                                                                                              |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entro, mas ao clicar em qualquer coisa volto para a tela de entrada | O navegador recusou o cookie. Se o acesso é por `http://`, deixe `COOKIE_SEGURO` vazio no `.env.producao`. Se há HTTPS na frente, use `COOKIE_SEGURO=1`. |
| Outro aparelho não abre o endereço                                  | Confira o IP, a porta e o firewall do servidor (liberar a porta 3000 para a rede privada).                                                               |
| Ver o que está acontecendo                                          | `docker compose -f docker-compose.producao.yml --env-file .env.producao logs -f app`                                                                     |
| Esqueci a senha do administrador                                    | Outro administrador redefine em **Usuários**. Se não houver outro, fale com o suporte.                                                                   |
