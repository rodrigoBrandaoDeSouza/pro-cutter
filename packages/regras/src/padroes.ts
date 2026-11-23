import type { ModeloPeca, ParametroRegra, TipoModulo } from './tipos.ts';

/** Parâmetros que vêm de fábrica nas Configurações; a marcenaria ajusta os valores e pode criar outros. */
export const PARAMETROS_PADRAO: ParametroRegra[] = [
  {
    chave: 'portaFolgaExt',
    rotulo: 'Folga da porta nas laterais',
    valor: 2,
    unidade: 'mm',
    grupo: 'Porta',
  },
  {
    chave: 'portaFolgaVert',
    rotulo: 'Folga da porta em cima e embaixo',
    valor: 3,
    unidade: 'mm',
    grupo: 'Porta',
  },
  {
    chave: 'portaFolgaEntre',
    rotulo: 'Folga entre portas',
    valor: 3,
    unidade: 'mm',
    grupo: 'Porta',
  },
  {
    chave: 'fundoEmCanal',
    rotulo: 'Fundo encaixado em canal',
    valor: 1,
    grupo: 'Fundo',
    ajuda: '1 = encaixado em canal nas laterais, base e tampo; 0 = sobreposto (pregado atrás)',
  },
  { chave: 'fundoCanal', rotulo: 'Profundidade do canal', valor: 8, unidade: 'mm', grupo: 'Fundo' },
  {
    chave: 'fundoFolga',
    rotulo: 'Folga do fundo por lado',
    valor: 1,
    unidade: 'mm',
    grupo: 'Fundo',
  },
];

const PORTA: ModeloPeca = {
  nome: 'Porta',
  tipo: 'porta',
  material: 'porta',
  condicao: 'nPortas > 0',
  quantidade: 'nPortas',
  comprimento: 'A - 2*portaFolgaVert',
  largura: '(L - 2*portaFolgaExt - (nPortas - 1)*portaFolgaEntre) / nPortas',
  fita: [0.45, 0.45, 0.45, 0.45],
};

const FUNDO: ModeloPeca = {
  nome: 'Fundo',
  tipo: 'fundo',
  material: 'fundo',
  quantidade: '1',
  comprimento: 'se(fundoEmCanal; A - 2*esp + 2*fundoCanal - 2*fundoFolga; A - 2*fundoFolga)',
  largura: 'se(fundoEmCanal; L - 2*esp + 2*fundoCanal - 2*fundoFolga; L - 2*fundoFolga)',
  fita: [0, 0, 0, 0],
};

/** Tipos de módulo de fábrica: todos geram portas sobrepostas e fundo. A marcenaria edita as fórmulas. */
export const TIPOS_PADRAO: TipoModulo[] = [
  { id: 'balcao', nome: 'Balcão', pecas: [PORTA, FUNDO] },
  { id: 'aereo', nome: 'Aéreo', pecas: [PORTA, FUNDO] },
  { id: 'torre', nome: 'Torre', pecas: [PORTA, FUNDO] },
  { id: 'nicho', nome: 'Nicho (sem porta)', pecas: [FUNDO] },
];
