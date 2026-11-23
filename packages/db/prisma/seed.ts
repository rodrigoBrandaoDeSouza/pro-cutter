import 'dotenv/config';
import { criarPrisma } from '../src/cliente.ts';
import { criarEmpresa } from '../src/empresa.ts';

/**
 * Cria a marcenaria inicial (se ainda não existir nenhuma) com o admin e os materiais da cozinha de exemplo.
 * Admin: SEED_ADMIN_EMAIL / SEED_ADMIN_SENHA (padrão admin@procutter.local / trocar-esta-senha).
 */
async function main() {
  const prisma = criarPrisma();
  try {
    if (await prisma.empresa.count()) {
      console.log('Já existe empresa cadastrada; seed não fez nada.');
      return;
    }
    const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@procutter.local';
    const senha = process.env.SEED_ADMIN_SENHA ?? 'trocar-esta-senha';
    const { empresa } = await criarEmpresa(prisma, {
      nome: process.env.SEED_EMPRESA ?? 'Minha Marcenaria',
      admin: { nome: 'Administrador', email, senha },
    });

    await prisma.material.createMany({
      data: [
        {
          empresaId: empresa.id,
          descricao: 'MDF Branco 15mm',
          espessura: 15,
          chapaComprimento: 2740,
          chapaLargura: 1840,
          temVeio: false,
          chavesPromob: ['Branco|15'],
          textoProg: 'MDF-15-Branco-MDF Branco 15mm',
        },
        {
          empresaId: empresa.id,
          descricao: 'MDF Fibraplac Linho Fendi 15mm',
          espessura: 15,
          chapaComprimento: 2750,
          chapaLargura: 1830,
          temVeio: true,
          chavesPromob: ['Fibraplac.Conceito.Linho Fendi|15'],
          textoProg:
            'MDF-15-Fibraplac.Conceito.Linho Fendi-MDF Fibraplac.Conceito.Linho Fendi 15mm',
        },
        {
          empresaId: empresa.id,
          descricao: 'MDF Branco 6mm',
          espessura: 6,
          chapaComprimento: 2750,
          chapaLargura: 1840,
          temVeio: false,
          chavesPromob: ['Branco|6'],
          textoProg: 'MDF-6-Branco-MDF Branco 6mm',
        },
      ],
    });
    await prisma.fita.createMany({
      data: [
        { empresaId: empresa.id, cor: 'Branco', espessura: 0.45 },
        { empresaId: empresa.id, cor: 'Linho Fendi', espessura: 0.45 },
      ],
    });
    console.log(
      `Empresa "${empresa.nome}" criada. Admin: ${email}${process.env.SEED_ADMIN_SENHA ? '' : ` / ${senha}`}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
