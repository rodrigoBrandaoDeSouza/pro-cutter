import { config } from 'dotenv';
import { criarPrisma, hashSenha } from '@pro-cutter/db';

/** Garante um usuário comum (não admin) na primeira empresa, para os testes de permissão. */
async function setup() {
  config({ path: '../../.env', quiet: true });
  const prisma = criarPrisma();
  try {
    const empresa = await prisma.empresa.findFirstOrThrow({ orderBy: { criadoEm: 'asc' } });
    await prisma.usuario.upsert({
      where: { email: 'usuario@procutter.local' },
      update: { ativo: true },
      create: {
        empresaId: empresa.id,
        nome: 'Usuária Comum',
        email: 'usuario@procutter.local',
        senhaHash: await hashSenha('usuario-teste-123'),
        papel: 'USUARIO',
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

setup().catch((e) => {
  console.error(e);
  process.exit(1);
});
