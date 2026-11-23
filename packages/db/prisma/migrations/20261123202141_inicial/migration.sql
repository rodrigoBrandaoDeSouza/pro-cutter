-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('ADMIN', 'USUARIO');

-- CreateEnum
CREATE TYPE "StatusProjeto" AS ENUM ('ORCAMENTO', 'APROVADO', 'EM_CORTE', 'CORTADO', 'ENTREGUE', 'CANCELADO');

-- CreateEnum
CREATE TYPE "OrigemPeca" AS ENUM ('XML', 'GERADA', 'MANUAL');

-- CreateEnum
CREATE TYPE "StatusPlano" AS ENUM ('ATUAL', 'DESATUALIZADO');

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracao" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "regras" JSONB NOT NULL,
    "tiposModulo" JSONB NOT NULL,
    "importacao" JSONB NOT NULL,
    "etiqueta" JSONB NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Configuracao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" "Papel" NOT NULL DEFAULT 'USUARIO',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sessao" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "espessura" DOUBLE PRECISION NOT NULL,
    "chapaComprimento" DOUBLE PRECISION NOT NULL,
    "chapaLargura" DOUBLE PRECISION NOT NULL,
    "temVeio" BOOLEAN NOT NULL DEFAULT false,
    "chavesPromob" TEXT[],
    "textoProg" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fita" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "cor" TEXT NOT NULL,
    "espessura" DOUBLE PRECISION NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Fita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Maquina" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "exportador" TEXT NOT NULL DEFAULT 'cvl-prog',
    "serra" DOUBLE PRECISION NOT NULL DEFAULT 4,
    "refiloFabrica" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "refiloSerrado" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "niveisMax" INTEGER NOT NULL DEFAULT 3,
    "sobraMinComp" DOUBLE PRECISION NOT NULL DEFAULT 300,
    "sobraMinLarg" DOUBLE PRECISION NOT NULL DEFAULT 300,
    "padrao" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Maquina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL DEFAULT '',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Projeto" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "status" "StatusProjeto" NOT NULL DEFAULT 'ORCAMENTO',
    "regras" JSONB NOT NULL,
    "tiposModulo" JSONB NOT NULL,
    "maquinaId" TEXT,
    "observacoes" TEXT NOT NULL DEFAULT '',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Projeto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricoStatus" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "projetoId" TEXT NOT NULL,
    "de" "StatusProjeto",
    "para" "StatusProjeto" NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ambiente" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "projetoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "xmlOriginal" TEXT,
    "importadoEm" TIMESTAMP(3),
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Ambiente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Modulo" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "ambienteId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipoId" TEXT NOT NULL,
    "L" DOUBLE PRECISION NOT NULL,
    "A" DOUBLE PRECISION NOT NULL,
    "P" DOUBLE PRECISION NOT NULL,
    "nPortas" INTEGER NOT NULL DEFAULT 0,
    "materialCaixaId" TEXT NOT NULL,
    "materialPortaId" TEXT,
    "materialFundoId" TEXT,
    "regras" JSONB NOT NULL DEFAULT '{}',
    "extras" JSONB NOT NULL DEFAULT '{}',
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Modulo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Peca" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "ambienteId" TEXT NOT NULL,
    "moduloId" TEXT,
    "origem" "OrigemPeca" NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'outro',
    "comprimento" DOUBLE PRECISION NOT NULL,
    "largura" DOUBLE PRECISION NOT NULL,
    "espessura" DOUBLE PRECISION NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "materialId" TEXT NOT NULL,
    "fita" DOUBLE PRECISION[],
    "podeGirar" BOOLEAN NOT NULL DEFAULT true,
    "materialAlternativo" BOOLEAN NOT NULL DEFAULT false,
    "promobId" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Peca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanoDeCorte" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "projetoId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "status" "StatusPlano" NOT NULL DEFAULT 'ATUAL',
    "parametros" JSONB NOT NULL,
    "chapas" JSONB NOT NULL,
    "pecas" JSONB NOT NULL,
    "materiais" JSONB NOT NULL,
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanoDeCorte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Configuracao_empresaId_key" ON "Configuracao"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_empresaId_idx" ON "Usuario"("empresaId");

-- CreateIndex
CREATE INDEX "Sessao_usuarioId_idx" ON "Sessao"("usuarioId");

-- CreateIndex
CREATE INDEX "Material_empresaId_idx" ON "Material"("empresaId");

-- CreateIndex
CREATE INDEX "Fita_empresaId_idx" ON "Fita"("empresaId");

-- CreateIndex
CREATE INDEX "Maquina_empresaId_idx" ON "Maquina"("empresaId");

-- CreateIndex
CREATE INDEX "Cliente_empresaId_idx" ON "Cliente"("empresaId");

-- CreateIndex
CREATE INDEX "Projeto_empresaId_status_idx" ON "Projeto"("empresaId", "status");

-- CreateIndex
CREATE INDEX "Projeto_empresaId_clienteId_idx" ON "Projeto"("empresaId", "clienteId");

-- CreateIndex
CREATE INDEX "HistoricoStatus_empresaId_projetoId_idx" ON "HistoricoStatus"("empresaId", "projetoId");

-- CreateIndex
CREATE INDEX "Ambiente_empresaId_projetoId_idx" ON "Ambiente"("empresaId", "projetoId");

-- CreateIndex
CREATE INDEX "Modulo_empresaId_ambienteId_idx" ON "Modulo"("empresaId", "ambienteId");

-- CreateIndex
CREATE INDEX "Peca_empresaId_ambienteId_idx" ON "Peca"("empresaId", "ambienteId");

-- CreateIndex
CREATE INDEX "PlanoDeCorte_empresaId_projetoId_idx" ON "PlanoDeCorte"("empresaId", "projetoId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanoDeCorte_projetoId_versao_key" ON "PlanoDeCorte"("projetoId", "versao");

-- AddForeignKey
ALTER TABLE "Configuracao" ADD CONSTRAINT "Configuracao_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sessao" ADD CONSTRAINT "Sessao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fita" ADD CONSTRAINT "Fita_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Maquina" ADD CONSTRAINT "Maquina_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Projeto" ADD CONSTRAINT "Projeto_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Projeto" ADD CONSTRAINT "Projeto_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Projeto" ADD CONSTRAINT "Projeto_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoStatus" ADD CONSTRAINT "HistoricoStatus_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "Projeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ambiente" ADD CONSTRAINT "Ambiente_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "Projeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Modulo" ADD CONSTRAINT "Modulo_ambienteId_fkey" FOREIGN KEY ("ambienteId") REFERENCES "Ambiente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Peca" ADD CONSTRAINT "Peca_ambienteId_fkey" FOREIGN KEY ("ambienteId") REFERENCES "Ambiente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Peca" ADD CONSTRAINT "Peca_moduloId_fkey" FOREIGN KEY ("moduloId") REFERENCES "Modulo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Peca" ADD CONSTRAINT "Peca_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanoDeCorte" ADD CONSTRAINT "PlanoDeCorte_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "Projeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
