/**
 * Dados FICTÍCIOS para demonstração: clientes, projetos dos últimos 12 meses, módulos com portas e
 * fundos, e planos de corte calculados pelo otimizador de verdade. Serve para ver o Painel cheio.
 *
 *   npm run db:seed-demo              cria (não faz nada se já houver dados de demonstração)
 *   npm run db:seed-demo -- --recriar apaga os dados de demonstração e cria de novo
 *
 * Nunca rode na marcenaria em produção: os projetos aparecem na lista como qualquer outro.
 */
import { config as carregarEnv } from 'dotenv';
import path from 'node:path';
import {
  validarPlano,
  type Fitas,
  type Material,
  type ParametrosCorte,
  type Peca,
} from '@pro-cutter/core';
import { criarPrisma, daEmpresa, json } from '@pro-cutter/db';
import { otimizarProjeto } from '@pro-cutter/otimizador';
import {
  gerarPecas,
  valoresDe,
  type Modulo,
  type ParametroRegra,
  type TipoModulo,
} from '@pro-cutter/regras';

carregarEnv({ path: path.resolve(import.meta.dirname, '../../../.env') });

export const MARCA_DEMO = 'Projeto fictício (dados de demonstração)';

/** Gerador pseudoaleatório com semente: o seed sai sempre igual. */
function aleatorio(semente: number) {
  let a = semente >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    r,
    int: (min: number, max: number) => min + Math.floor(r() * (max - min + 1)),
    item: <T>(lista: readonly T[]) => lista[Math.floor(r() * lista.length)]!,
  };
}

const CLIENTES = [
  ['Ana Paula Ferreira', '(11) 98765-1001'],
  ['Bruno Carvalho', '(11) 98765-1002'],
  ['Camila Rocha', '(11) 98765-1003'],
  ['Diego Martins', '(11) 98765-1004'],
  ['Eduarda Lima', '(11) 98765-1005'],
  ['Fernando Azevedo', '(11) 98765-1006'],
  ['Gabriela Nunes', '(11) 98765-1007'],
  ['Henrique Prado', '(11) 98765-1008'],
  ['Isabela Moura', '(11) 98765-1009'],
  ['João Pedro Teixeira', '(11) 98765-1010'],
  ['Karina Duarte', '(11) 98765-1011'],
  ['Lucas Andrade', '(11) 98765-1012'],
  ['Mariana Costa', '(11) 98765-1013'],
  ['Nicolas Barros', '(11) 98765-1014'],
  ['Olívia Pires', '(11) 98765-1015'],
  ['Construtora Horizonte (fictícia)', '(11) 3456-7000'],
  ['Arquiteta Paula Siqueira', '(11) 98765-1017'],
  ['Rafael Monteiro', '(11) 98765-1018'],
] as const;

const MATERIAIS_DEMO = [
  { descricao: 'MDF Branco 15mm', espessura: 15, c: 2740, l: 1840, veio: false, preco: 289 },
  {
    descricao: 'MDF Fibraplac Linho Fendi 15mm',
    espessura: 15,
    c: 2750,
    l: 1830,
    veio: true,
    preco: 429,
  },
  { descricao: 'MDF Branco 6mm', espessura: 6, c: 2750, l: 1840, veio: false, preco: 139 },
  { descricao: 'MDF Branco 18mm', espessura: 18, c: 2750, l: 1840, veio: false, preco: 329 },
  { descricao: 'MDF Cinza Grafite 18mm', espessura: 18, c: 2750, l: 1840, veio: false, preco: 469 },
  {
    descricao: 'MDF Carvalho Hanover 18mm',
    espessura: 18,
    c: 2750,
    l: 1840,
    veio: true,
    preco: 539,
  },
] as const;

/** Ambientes típicos: módulos [tipo, L, A, P, portas] com variação de medida. */
const AMBIENTES: Record<string, [string, number, number, number, number][]> = {
  Cozinha: [
    ['balcao', 800, 720, 550, 2],
    ['balcao', 600, 720, 550, 1],
    ['balcao', 400, 720, 550, 1],
    ['balcao', 1000, 720, 550, 2],
    ['aereo', 800, 700, 350, 2],
    ['aereo', 600, 700, 350, 2],
    ['aereo', 1000, 400, 350, 2],
    ['torre', 600, 2100, 580, 2],
  ],
  'Dormitório casal': [
    ['torre', 900, 2400, 600, 2],
    ['torre', 900, 2400, 600, 2],
    ['torre', 600, 2400, 600, 1],
    ['nicho', 450, 500, 400, 0],
    ['nicho', 450, 500, 400, 0],
  ],
  'Dormitório solteiro': [
    ['torre', 800, 2300, 580, 2],
    ['torre', 500, 2300, 580, 1],
    ['nicho', 800, 300, 300, 0],
  ],
  Banheiro: [
    ['balcao', 800, 600, 450, 2],
    ['aereo', 600, 700, 200, 2],
  ],
  'Área de serviço': [
    ['balcao', 700, 850, 600, 2],
    ['aereo', 1200, 600, 350, 3],
    ['torre', 600, 2100, 400, 1],
  ],
  'Home office': [
    ['balcao', 450, 720, 550, 1],
    ['nicho', 1200, 350, 300, 0],
    ['nicho', 1200, 350, 300, 0],
    ['aereo', 900, 600, 350, 2],
  ],
  Closet: [
    ['torre', 1000, 2500, 600, 0],
    ['torre', 1000, 2500, 600, 0],
    ['torre', 600, 2500, 600, 2],
    ['nicho', 1000, 400, 600, 0],
  ],
  'Sala (painel e rack)': [
    ['balcao', 1800, 450, 450, 3],
    ['nicho', 1800, 900, 300, 0],
  ],
};

const COMBINACOES = [
  ['Cozinha'],
  ['Cozinha', 'Área de serviço'],
  ['Dormitório casal'],
  ['Dormitório casal', 'Closet'],
  ['Dormitório solteiro'],
  ['Banheiro'],
  ['Banheiro', 'Dormitório solteiro'],
  ['Home office'],
  ['Sala (painel e rack)'],
  ['Cozinha', 'Sala (painel e rack)', 'Banheiro'],
] as const;

/** Combinações de chapa caixa/porta: cor da caixa e cor da frente. */
const ACABAMENTOS = [
  ['MDF Branco 15mm', 'MDF Fibraplac Linho Fendi 15mm'],
  ['MDF Branco 15mm', 'MDF Branco 15mm'],
  ['MDF Branco 18mm', 'MDF Cinza Grafite 18mm'],
  ['MDF Branco 18mm', 'MDF Carvalho Hanover 18mm'],
  ['MDF Branco 15mm', 'MDF Cinza Grafite 18mm'],
] as const;

const NOMES_MODULO: Record<string, string> = {
  balcao: 'Balcão',
  aereo: 'Aéreo',
  torre: 'Torre',
  nicho: 'Nicho',
};

/** Peças da caixa como viriam do Promob: laterais, base, tampo e prateleira. */
function pecasDaCaixa(m: Modulo, esp: number, materialId: string, fita: number) {
  const interna = m.L - 2 * esp;
  const lista: Omit<Peca, 'id' | 'origem' | 'refs'>[] = [
    {
      nome: 'Lateral',
      comprimento: m.A,
      largura: m.P,
      quantidade: 2,
      fita: [fita, 0, 0, 0] as Fitas,
    },
    {
      nome: 'Base',
      comprimento: interna,
      largura: m.P,
      quantidade: 1,
      fita: [fita, 0, 0, 0] as Fitas,
    },
    {
      nome: m.tipoId === 'aereo' ? 'Tampo' : 'Travessa',
      comprimento: interna,
      largura: m.tipoId === 'aereo' ? m.P : 100,
      quantidade: m.tipoId === 'aereo' ? 1 : 2,
      fita: [fita, 0, 0, 0] as Fitas,
    },
  ].map((p) => ({ ...p, espessura: esp, materialId, tipo: 'caixa', podeGirar: true }) as const);
  const prateleiras = m.A > 1500 ? 4 : m.A > 600 ? 1 : 0;
  if (prateleiras) {
    lista.push({
      nome: 'Prateleira',
      tipo: 'prateleira',
      comprimento: interna - 2,
      largura: m.P - 30,
      espessura: esp,
      quantidade: prateleiras,
      materialId,
      fita: [fita, 0, 0, 0] as Fitas,
      podeGirar: true,
    });
  }
  return lista;
}

type Status = 'ORCAMENTO' | 'APROVADO' | 'EM_CORTE' | 'CORTADO' | 'ENTREGUE' | 'CANCELADO';
const FLUXO: Status[] = ['ORCAMENTO', 'APROVADO', 'EM_CORTE', 'CORTADO', 'ENTREGUE'];

/** Projetos antigos já foram entregues; os do mês corrente estão começando. */
function statusFinal(mesesAtras: number, rnd: ReturnType<typeof aleatorio>): Status {
  if (rnd.r() < 0.06) return 'CANCELADO';
  if (mesesAtras >= 3) return 'ENTREGUE';
  if (mesesAtras === 2) return rnd.item(['ENTREGUE', 'ENTREGUE', 'CORTADO']);
  if (mesesAtras === 1) return rnd.item(['CORTADO', 'ENTREGUE', 'EM_CORTE']);
  return rnd.item(['ORCAMENTO', 'APROVADO', 'EM_CORTE', 'EM_CORTE', 'CORTADO']);
}

const dia = 24 * 3600 * 1000;

async function main() {
  const recriar = process.argv.includes('--recriar');
  const prisma = criarPrisma();
  try {
    const empresa = await prisma.empresa.findFirst({ orderBy: { criadoEm: 'asc' } });
    if (!empresa) throw new Error('Nenhuma marcenaria. Rode antes: npm run db:seed');
    const db = daEmpresa(prisma, empresa.id);
    const admin = await db.usuario.findFirst({ where: { papel: 'ADMIN' } });
    if (!admin) throw new Error('A marcenaria não tem administrador.');

    const existentes = await db.projeto.count({ where: { observacoes: MARCA_DEMO } });
    if (existentes && !recriar) {
      console.log(`Já há ${existentes} projetos de demonstração. Use --recriar para refazer.`);
      return;
    }
    if (existentes) {
      const clientes = await db.projeto.findMany({
        where: { observacoes: MARCA_DEMO },
        select: { clienteId: true },
      });
      await db.projeto.deleteMany({ where: { observacoes: MARCA_DEMO } });
      await db.cliente.deleteMany({
        where: { id: { in: clientes.map((c) => c.clienteId) }, projetos: { none: {} } },
      });
      console.log(`${existentes} projetos de demonstração apagados.`);
    }

    // Materiais com preço (os que já existem ganham preço só se ainda não tiverem)
    const materiais = new Map<string, Material>();
    for (const m of MATERIAIS_DEMO) {
      let reg = await db.material.findFirst({ where: { descricao: m.descricao } });
      if (!reg) {
        reg = await db.material.create({
          data: {
            empresaId: empresa.id,
            descricao: m.descricao,
            espessura: m.espessura,
            chapaComprimento: m.c,
            chapaLargura: m.l,
            temVeio: m.veio,
            textoProg: `MDF-${m.espessura}-${m.descricao}`,
            precoChapa: m.preco,
          },
        });
      } else if (reg.precoChapa == null) {
        reg = await db.material.update({ where: { id: reg.id }, data: { precoChapa: m.preco } });
      }
      materiais.set(m.descricao, {
        id: reg.id,
        descricao: reg.descricao,
        espessura: reg.espessura,
        chapa: { comprimento: reg.chapaComprimento, largura: reg.chapaLargura },
        temVeio: reg.temVeio,
      });
    }
    const mat = (d: string) => {
      const m = materiais.get(d);
      if (!m) throw new Error(`Material ${d} não encontrado`);
      return m;
    };

    const cfg = await db.configuracao.findFirstOrThrow();
    const regras = valoresDe(cfg.regras as unknown as ParametroRegra[]);
    const tipos = cfg.tiposModulo as unknown as TipoModulo[];
    const maquina = await db.maquina.findFirstOrThrow({ where: { padrao: true } });
    const params: ParametrosCorte = {
      serra: maquina.serra,
      refiloFabrica: maquina.refiloFabrica,
      refiloSerrado: maquina.refiloSerrado,
      niveisMax: maquina.niveisMax,
      sobraMinima: { comprimento: maquina.sobraMinComp, largura: maquina.sobraMinLarg },
    };

    const rnd = aleatorio(2026);
    const clientes = [];
    for (const [nome, telefone] of CLIENTES) {
      clientes.push(
        (await db.cliente.findFirst({ where: { nome } })) ??
          (await db.cliente.create({ data: { empresaId: empresa.id, nome, telefone } })),
      );
    }

    const hoje = new Date();
    let criados = 0;
    let planos = 0;
    for (let mesesAtras = 11; mesesAtras >= 0; mesesAtras--) {
      const quantos = rnd.int(2, 5);
      for (let k = 0; k < quantos; k++) {
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth() - mesesAtras, 1);
        const limite = mesesAtras === 0 ? hoje.getDate() - 1 : 27;
        const criadoEm = new Date(inicioMes.getTime() + rnd.int(0, Math.max(0, limite)) * dia);
        criadoEm.setHours(rnd.int(8, 17), rnd.int(0, 59));
        const cliente = rnd.item(clientes);
        const comb = rnd.item(COMBINACOES);
        const [caixaNome, portaNome] = rnd.item(ACABAMENTOS);
        const caixa = mat(caixaNome);
        const porta = mat(portaNome);
        const fundo = mat('MDF Branco 6mm');
        const final = statusFinal(mesesAtras, rnd);

        const projeto = await db.projeto.create({
          data: {
            empresaId: empresa.id,
            clienteId: cliente.id,
            nome: `${comb.join(' + ')} – ${cliente.nome.split(' ')[0]}`,
            status: final,
            regras: json(regras),
            tiposModulo: json(tipos),
            maquinaId: maquina.id,
            observacoes: MARCA_DEMO,
            criadoEm,
            atualizadoEm: criadoEm,
          },
        });

        // Histórico de status: anda pelo fluxo até o status final, alguns dias por etapa
        const etapas =
          final === 'CANCELADO'
            ? (['ORCAMENTO', 'CANCELADO'] as Status[])
            : FLUXO.slice(0, FLUXO.indexOf(final) + 1);
        let quando = criadoEm.getTime();
        let deStatus: Status | null = null;
        let corteEm = criadoEm;
        for (const para of etapas) {
          await db.historicoStatus.create({
            data: {
              empresaId: empresa.id,
              projetoId: projeto.id,
              de: deStatus,
              para,
              usuarioId: admin.id,
              em: new Date(Math.min(quando, hoje.getTime())),
            },
          });
          if (para === 'EM_CORTE') corteEm = new Date(Math.min(quando, hoje.getTime()));
          deStatus = para;
          quando += rnd.int(2, 9) * dia;
        }

        // Ambientes, módulos e peças
        const pecasProjeto: Peca[] = [];
        for (const [ordemAmb, nomeAmb] of comb.entries()) {
          const amb = await db.ambiente.create({
            data: { empresaId: empresa.id, projetoId: projeto.id, nome: nomeAmb, ordem: ordemAmb },
          });
          const base = AMBIENTES[nomeAmb]!;
          const lista = base.filter(() => rnd.r() < 0.85);
          for (const [i, [tipoId, L0, A, P, nPortas]] of lista.entries()) {
            const L = Math.max(300, L0 + rnd.item([-200, -100, 0, 0, 100, 150]));
            const tipo = tipos.find((t) => t.id === tipoId) ?? tipos[0]!;
            const reg = await db.modulo.create({
              data: {
                empresaId: empresa.id,
                ambienteId: amb.id,
                nome: `${NOMES_MODULO[tipoId] ?? tipoId} ${L}`,
                tipoId: tipo.id,
                L,
                A,
                P,
                nPortas,
                materialCaixaId: caixa.id,
                materialPortaId: porta.id,
                materialFundoId: fundo.id,
                ordem: i,
              },
            });
            const modulo: Modulo = {
              id: reg.id,
              nome: reg.nome,
              tipoId: tipo.id,
              L,
              A,
              P,
              nPortas,
              materiais: { caixa: caixa.id, porta: porta.id, fundo: fundo.id },
              ambienteId: amb.id,
            };
            const geradas = gerarPecas(modulo, tipo, regras, [...materiais.values()]).pecas;
            const daCaixa = pecasDaCaixa(modulo, caixa.espessura, caixa.id, 0.45);
            const linhas = [
              ...daCaixa.map((p) => ({ ...p, origem: 'XML' as const })),
              ...geradas.map((p) => ({ ...p, origem: 'GERADA' as const })),
            ];
            for (const [ordem, p] of linhas.entries()) {
              const material = [...materiais.values()].find((m) => m.id === p.materialId)!;
              const criada = await db.peca.create({
                data: {
                  empresaId: empresa.id,
                  ambienteId: amb.id,
                  moduloId: reg.id,
                  origem: p.origem,
                  nome: p.nome,
                  tipo: p.tipo ?? 'outro',
                  comprimento: p.comprimento,
                  largura: p.largura,
                  espessura: p.espessura,
                  quantidade: p.quantidade,
                  materialId: p.materialId,
                  fita: [...p.fita],
                  podeGirar: p.podeGirar && !material.temVeio,
                  ordem,
                },
              });
              pecasProjeto.push({
                id: criada.id,
                nome: criada.nome,
                tipo: criada.tipo,
                comprimento: criada.comprimento,
                largura: criada.largura,
                espessura: criada.espessura,
                quantidade: criada.quantidade,
                materialId: criada.materialId,
                fita: [...p.fita] as Fitas,
                podeGirar: criada.podeGirar,
                origem: p.origem === 'XML' ? 'xml' : 'gerada',
                refs: { ambienteId: amb.id, moduloId: reg.id },
              });
            }
          }
        }

        // Plano de corte para quem passou do orçamento (e para parte dos orçamentos)
        if (final !== 'ORCAMENTO' || rnd.r() < 0.5) {
          const usados = [...materiais.values()].filter((m) =>
            pecasProjeto.some((p) => p.materialId === m.id),
          );
          const plano = otimizarProjeto(pecasProjeto, usados, params, {
            semente: 1,
            iteracoes: 120,
            tempoMs: 800,
          });
          const erros = validarPlano(plano, { pecas: pecasProjeto, materiais: usados, params });
          if (erros.length) throw new Error(`Plano inválido: ${erros[0]!.mensagem}`);
          const planoEm =
            final === 'ORCAMENTO' || final === 'CANCELADO'
              ? new Date(criadoEm.getTime() + dia)
              : corteEm;
          await db.planoDeCorte.create({
            data: {
              empresaId: empresa.id,
              projetoId: projeto.id,
              versao: 1,
              parametros: json({ ...params, fixadas: [] }),
              chapas: json(plano.chapas),
              pecas: json(pecasProjeto),
              materiais: json(usados),
              criadoPorId: admin.id,
              criadoEm: planoEm,
            },
          });
          planos++;
        }
        criados++;
        process.stdout.write(`\r${criados} projetos, ${planos} planos de corte...`);
      }
    }
    console.log(`\nPronto: ${criados} projetos fictícios em ${CLIENTES.length} clientes.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
