import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { entrar, encerrarSessoes, sair, sessaoAtual } from './auth.ts';
import { criarPrisma, daEmpresa, type PrismaClient } from './cliente.ts';
import { criarEmpresa } from './empresa.ts';

let prisma: PrismaClient;
let empA: { empresa: { id: string }; admin: { id: string } };
let empB: { empresa: { id: string }; admin: { id: string } };

beforeAll(async () => {
  prisma = criarPrisma(process.env.DATABASE_URL_TESTE ?? process.env.DATABASE_URL);
  empA = await criarEmpresa(prisma, {
    nome: 'Marcenaria A',
    admin: { nome: 'Ana', email: 'Ana@A.com', senha: 'senha-forte-a' },
  });
  empB = await criarEmpresa(prisma, {
    nome: 'Marcenaria B',
    admin: { nome: 'Bruno', email: 'bruno@b.com', senha: 'senha-forte-b' },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('criarEmpresa', () => {
  it('cria configuração padrão, máquina CVL e admin', async () => {
    const cfg = await prisma.configuracao.findUniqueOrThrow({
      where: { empresaId: empA.empresa.id },
    });
    expect((cfg.tiposModulo as { id: string }[]).map((t) => t.id)).toContain('balcao');
    expect(cfg.etiqueta).toEqual({ largura: 100, altura: 50 });
    const maq = await prisma.maquina.findFirstOrThrow({ where: { empresaId: empA.empresa.id } });
    expect(maq).toMatchObject({ exportador: 'cvl-prog', niveisMax: 3, padrao: true });
    const admin = await prisma.usuario.findUniqueOrThrow({ where: { id: empA.admin.id } });
    expect(admin.email).toBe('ana@a.com');
    expect(admin.papel).toBe('ADMIN');
    expect(admin.senhaHash).toMatch(/^\$argon2id\$/);
  });

  it('recusa senha curta', async () => {
    await expect(
      criarEmpresa(prisma, { nome: 'X', admin: { nome: 'x', email: 'x@x.com', senha: '123' } }),
    ).rejects.toThrow(/8 caracteres/);
  });
});

describe('daEmpresa: isolamento entre marcenarias', () => {
  it('só enxerga, altera e apaga os próprios dados', async () => {
    const a = daEmpresa(prisma, empA.empresa.id);
    const b = daEmpresa(prisma, empB.empresa.id);
    const clienteA = await a.cliente.create({
      data: { empresaId: empA.empresa.id, nome: 'Everaldo', telefone: '45999999999' },
    });
    await b.cliente.create({ data: { empresaId: empB.empresa.id, nome: 'Cliente do B' } });

    expect(clienteA.empresaId).toBe(empA.empresa.id);
    expect((await a.cliente.findMany()).map((c) => c.nome)).toEqual(['Everaldo']);
    expect(await b.cliente.count()).toBe(1);

    // mesmo sabendo o id, a outra empresa não lê, não altera e não apaga
    expect(await b.cliente.findUnique({ where: { id: clienteA.id } })).toBeNull();
    expect(await b.cliente.findFirst({ where: { id: clienteA.id } })).toBeNull();
    await expect(
      b.cliente.update({ where: { id: clienteA.id }, data: { nome: 'hack' } }),
    ).rejects.toThrow();
    expect((await b.cliente.deleteMany({ where: { id: clienteA.id } })).count).toBe(0);
    expect((await a.cliente.findUniqueOrThrow({ where: { id: clienteA.id } })).nome).toBe(
      'Everaldo',
    );
  });

  it('não deixa trocar o empresaId na criação', async () => {
    const a = daEmpresa(prisma, empA.empresa.id);
    const c = await a.cliente.create({ data: { nome: 'Teste', empresaId: empB.empresa.id } });
    expect(c.empresaId).toBe(empA.empresa.id);
  });
});

describe('autenticação', () => {
  it('entra com e-mail (sem diferenciar maiúsculas) e senha certos', async () => {
    const r = await entrar(prisma, ' ANA@a.com ', 'senha-forte-a');
    expect(r?.usuario).toMatchObject({ nome: 'Ana', papel: 'ADMIN', empresaId: empA.empresa.id });
    expect(r!.token.length).toBeGreaterThanOrEqual(40);
    const s = await sessaoAtual(prisma, r!.token);
    expect(s?.usuario.id).toBe(empA.admin.id);
  });

  it('senha errada, e-mail inexistente e token inválido', async () => {
    expect(await entrar(prisma, 'ana@a.com', 'errada')).toBeNull();
    expect(await entrar(prisma, 'ninguem@a.com', 'senha-forte-a')).toBeNull();
    expect(await sessaoAtual(prisma, 'token-que-nao-existe')).toBeNull();
    expect(await sessaoAtual(prisma, undefined)).toBeNull();
  });

  it('o banco não guarda o token, só o hash', async () => {
    const r = await entrar(prisma, 'bruno@b.com', 'senha-forte-b');
    expect(await prisma.sessao.findUnique({ where: { id: r!.token } })).toBeNull();
  });

  it('sair e encerrar todas as sessões', async () => {
    const r1 = await entrar(prisma, 'bruno@b.com', 'senha-forte-b');
    const r2 = await entrar(prisma, 'bruno@b.com', 'senha-forte-b');
    await sair(prisma, r1!.token);
    expect(await sessaoAtual(prisma, r1!.token)).toBeNull();
    expect(await sessaoAtual(prisma, r2!.token)).not.toBeNull();
    await encerrarSessoes(prisma, empB.admin.id);
    expect(await sessaoAtual(prisma, r2!.token)).toBeNull();
  });

  it('sessão expirada é recusada e removida; perto de expirar é renovada', async () => {
    const r = await entrar(prisma, 'bruno@b.com', 'senha-forte-b');
    const sessao = await prisma.sessao.findFirstOrThrow({
      where: { usuarioId: empB.admin.id },
      orderBy: { criadoEm: 'desc' },
    });

    await prisma.sessao.update({
      where: { id: sessao.id },
      data: { expiraEm: new Date(Date.now() + 2 * 24 * 3600 * 1000) },
    });
    const renovada = await sessaoAtual(prisma, r!.token);
    expect(renovada!.expiraEm.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 3600 * 1000);

    await prisma.sessao.update({
      where: { id: sessao.id },
      data: { expiraEm: new Date(Date.now() - 1000) },
    });
    expect(await sessaoAtual(prisma, r!.token)).toBeNull();
    expect(await prisma.sessao.findUnique({ where: { id: sessao.id } })).toBeNull();
  });

  it('usuário desativado não entra e perde a sessão', async () => {
    const r = await entrar(prisma, 'bruno@b.com', 'senha-forte-b');
    await prisma.usuario.update({ where: { id: empB.admin.id }, data: { ativo: false } });
    expect(await sessaoAtual(prisma, r!.token)).toBeNull();
    expect(await entrar(prisma, 'bruno@b.com', 'senha-forte-b')).toBeNull();
    await prisma.usuario.update({ where: { id: empB.admin.id }, data: { ativo: true } });
  });
});
