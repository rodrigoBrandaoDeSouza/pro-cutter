import { CONFIG_PADRAO } from '@pro-cutter/promob';
import { PARAMETROS_PADRAO, TIPOS_PADRAO } from '@pro-cutter/regras';
import { hashSenha, validarSenhaNova } from './auth.ts';
import { json, type PrismaClient } from './cliente.ts';

/** Configuração de fábrica de uma marcenaria nova. */
export function configuracaoPadrao() {
  return {
    regras: json(PARAMETROS_PADRAO),
    tiposModulo: json(TIPOS_PADRAO),
    importacao: json({
      mapaGrupos: CONFIG_PADRAO.mapaGrupos,
      origemPorTipo: CONFIG_PADRAO.origemPorTipo,
      ladosFita: CONFIG_PADRAO.ladosFita,
    }),
    etiqueta: json({ largura: 100, altura: 50 }),
  };
}

export interface NovaEmpresa {
  nome: string;
  admin: { nome: string; email: string; senha: string };
}

/** Cria a empresa com configuração padrão, a máquina CVL Máxima e o usuário administrador. */
export async function criarEmpresa(prisma: PrismaClient, dados: NovaEmpresa) {
  const erroSenha = validarSenhaNova(dados.admin.senha);
  if (erroSenha) throw new Error(erroSenha);
  const senhaHash = await hashSenha(dados.admin.senha);

  return prisma.$transaction(async (tx) => {
    const empresa = await tx.empresa.create({ data: { nome: dados.nome } });
    await tx.configuracao.create({ data: { empresaId: empresa.id, ...configuracaoPadrao() } });
    await tx.maquina.create({
      data: { empresaId: empresa.id, nome: 'Seccionadora CVL Máxima', padrao: true },
    });
    const admin = await tx.usuario.create({
      data: {
        empresaId: empresa.id,
        nome: dados.admin.nome,
        email: dados.admin.email.trim().toLowerCase(),
        senhaHash,
        papel: 'ADMIN',
        deveTrocarSenha: true,
      },
    });
    return { empresa, admin };
  });
}
