-- AlterTable
ALTER TABLE "Configuracao" ADD COLUMN     "aproveitamentoReferencia" DOUBLE PRECISION NOT NULL DEFAULT 0.7;

-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "precoChapa" DOUBLE PRECISION;
