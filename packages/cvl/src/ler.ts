import {
  ESCADA,
  indiceNivel,
  nivelInicial,
  proximoNivel,
  type ChapaPlano,
  type Nivel,
  type NoCorte,
} from '@pro-cutter/core';

export interface ProgLido {
  chapa: ChapaPlano;
  materialTexto: string;
  espessura: number;
  /** Quantas chapas iguais cortar com este padrão. */
  quantidade: number;
}

interface CorteBruto {
  id: number;
  quantidade: number;
  tipo: string;
  valor: number;
}

const RAIZ = /<com\.cutplanning\.cvl\.program ([^>]*)>/;
const CORTE = /<com\.cutplanning\.cvl\.program\.cut ([^>]*)\/>/g;

function atributos(s: string): Record<string, string> {
  return Object.fromEntries([...s.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1]!, m[2]!]));
}

function ehNivel(s: string): s is Nivel {
  return (ESCADA as readonly string[]).includes(s);
}

/** Lê um arquivo .prog da CVL Máxima e reconstrói a árvore de cortes da chapa. */
export function lerProg(xml: string, numero = 1): ProgLido {
  const raiz = RAIZ.exec(xml);
  if (!raiz) throw new Error('Arquivo não é um .prog da CVL (elemento program ausente)');
  const r = atributos(raiz[1]!);

  const cortes: CorteBruto[] = [...xml.matchAll(CORTE)].map((m) => {
    const a = atributos(m[1]!);
    return {
      id: Number(a.id),
      quantidade: Number(a.quantity),
      tipo: a.type ?? '',
      valor: Number(a.value),
    };
  });

  const primeiro = cortes.find((c) => !c.tipo.endsWith('*'));
  const tipoInicial = primeiro?.tipo.replace(/^R/, '') ?? '1Y';
  const inicio = tipoInicial === '1X' ? 'X' : 'Y';

  const chapa: ChapaPlano = {
    numero,
    materialId: '',
    comprimento: Number(r.lenght),
    largura: Number(r.width),
    inicio,
    nos: [],
  };

  /** Pilha de grupos abertos: cada um guarda o nível dos seus nós e o nó dono (null = chapa). */
  const pilha: { nivel: Nivel; nos: NoCorte[]; dono: NoCorte | null }[] = [
    { nivel: nivelInicial(inicio), nos: chapa.nos, dono: null },
  ];

  const irPara = (nivel: Nivel, c: CorteBruto) => {
    while (pilha.length > 1 && indiceNivel(pilha.at(-1)!.nivel) > indiceNivel(nivel)) pilha.pop();
    const topo = pilha.at(-1)!;
    if (topo.nivel === nivel) return topo;
    const dono = topo.nos.at(-1);
    if (
      indiceNivel(nivel) < indiceNivel(topo.nivel) ||
      !dono ||
      proximoNivel(topo.nivel) !== nivel
    ) {
      throw new Error(`Corte ${c.id} (${c.tipo}) fora da sequência de níveis`);
    }
    const grupo = { nivel, nos: dono.filhos, dono };
    pilha.push(grupo);
    return grupo;
  };

  for (const c of cortes) {
    if (c.tipo.endsWith('*')) continue; // marcador de modo: a estrutura já é dada pela sequência
    const refilo = c.tipo.startsWith('R');
    const tipo = refilo ? c.tipo.slice(1) : c.tipo;
    if (!ehNivel(tipo)) throw new Error(`Corte ${c.id}: tipo desconhecido ${c.tipo}`);

    const grupo = irPara(tipo, c);
    if (refilo) {
      if (grupo.dono) grupo.dono.refiloFilhos = c.valor;
      else chapa.refilo = c.valor;
      continue;
    }
    for (let q = 0; q < c.quantidade; q++)
      grupo.nos.push({ nivel: tipo, medida: c.valor, filhos: [] });
  }

  let n = 0;
  const numerar = (nos: NoCorte[]) => {
    for (const no of nos) {
      if (no.filhos.length) numerar(no.filhos);
      else no.pecaId = `p${++n}`;
    }
  };
  numerar(chapa.nos);

  return {
    chapa,
    materialTexto: r.material ?? '',
    espessura: Number(r.thickness),
    quantidade: Number(r.quantity) || 1,
  };
}
