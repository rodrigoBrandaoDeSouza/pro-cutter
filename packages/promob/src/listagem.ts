import { XMLParser } from 'fast-xml-parser';

/** Um ITEM da listagem do Promob, com os campos úteis para o corte (ver .doc/analise-xml-promob.md). */
export interface ItemPromob {
  uniqueId: string;
  idModelo: string;
  descricao: string;
  grupo: string;
  /** WIDTH: medida que vai no eixo X (comprimento da chapa). */
  largura: number;
  /** HEIGHT: espessura nas peças de chapa. */
  altura: number;
  /** DEPTH: medida que vai no eixo Y. */
  profundidade: number;
  /** REPETITION: quantidade de peças iguais (QUANTITY é área em m², não usar). */
  repeticao: number;
  /** PLATECUTTINGROTATE: 'N' = não gira; 'NONE' = livre. */
  rotacao: string;
  material: string;
  modelo: string;
  modeloDescricao: string;
  espessura: number;
  /** FITA_BORDA_1..4 (mm; 0 = sem fita), na convenção do Promob. */
  fitas: [number, number, number, number];
  corFita: string;
  chapaMax?: { comprimento: number; largura: number };
  uniqueIdsAgrupados: string[];
}

export interface AmbientePromob {
  descricao: string;
  itens: ItemPromob[];
}

export interface ListagemPromob {
  projeto: { guid: string; data: string; unidade: string };
  cliente: { nome: string; telefone: string; email: string };
  ambientes: AmbientePromob[];
}

type No = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  isArray: (nome) => ['AMBIENT', 'CATEGORY', 'ITEM', 'DATA', 'METADATA'].includes(nome),
});

export function lerListagem(xml: string): ListagemPromob {
  const raiz = (parser.parse(semBom(xml)) as No)['LISTING'] as No | undefined;
  if (!raiz) throw new Error('Arquivo não é uma listagem do Promob (elemento LISTING ausente)');

  const dados = new Map(
    lista(no(raiz['CUSTOMERSDATA'])['DATA']).map((d) => [txt(d['@_ID']), txt(d['@_VALUE'])]),
  );

  return {
    projeto: {
      guid: txt(no(raiz['PROJECTGUID'])['@_GUID']),
      data: txt(raiz['@_DATE']),
      unidade: txt(raiz['@_UNIT']),
    },
    cliente: {
      nome: dados.get('nomecliente') ?? '',
      telefone: dados.get('celular') ?? dados.get('fone') ?? '',
      email: dados.get('email') ?? '',
    },
    ambientes: lista(no(raiz['AMBIENTS'])['AMBIENT']).map((amb) => ({
      descricao: txt(amb['@_DESCRIPTION']),
      itens: lista(no(amb['CATEGORIES'])['CATEGORY']).flatMap((cat) =>
        lista(no(cat['ITEMS'])['ITEM']).map(lerItem),
      ),
    })),
  };
}

function lerItem(i: No): ItemPromob {
  const refs = no(i['REFERENCES']);
  const ref = (nome: string) => txt(no(refs[nome])['@_REFERENCE']);
  const uniqueId = txt(i['@_UNIQUEID']);
  const agrupados = lista(no(i['METADATAS'])['METADATA']).find(
    (m) => txt(m['@_ID']) === 'UniqueIdCollection',
  );
  const maxC = num(ref('MAXWIDTH'));
  const maxL = num(ref('MAXDEPTH'));

  return {
    uniqueId,
    idModelo: txt(i['@_ID']),
    descricao: txt(i['@_DESCRIPTION']),
    grupo: txt(i['@_GROUP']),
    largura: num(i['@_WIDTH']),
    altura: num(i['@_HEIGHT']),
    profundidade: num(i['@_DEPTH']),
    repeticao: num(i['@_REPETITION']) || 1,
    rotacao: txt(i['@_PLATECUTTINGROTATE']),
    material: ref('MATERIAL'),
    modelo: ref('MODEL'),
    modeloDescricao: ref('MODEL_DESCRIPTION'),
    espessura: num(ref('THICKNESS')),
    fitas: [1, 2, 3, 4].map((n) => num(ref(`FITA_BORDA_${n}`))) as ItemPromob['fitas'],
    corFita: ref('MODEL_DESCRIPTION_FITA'),
    ...(maxC && maxL ? { chapaMax: { comprimento: maxC, largura: maxL } } : {}),
    uniqueIdsAgrupados: agrupados
      ? txt(agrupados['@_VALUE']).split(';').filter(Boolean)
      : [uniqueId],
  };
}

function semBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function no(v: unknown): No {
  return v && typeof v === 'object' ? (v as No) : {};
}

function lista(v: unknown): No[] {
  return Array.isArray(v) ? (v as No[]) : [];
}

function txt(v: unknown): string {
  return v === undefined || v === null ? '' : String(v);
}

function num(v: unknown): number {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
