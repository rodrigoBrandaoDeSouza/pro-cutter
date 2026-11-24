/**
 * Avaliador de fórmulas das marcenarias. Não usa eval/Function: o texto vira uma árvore própria
 * e só pode ler as variáveis informadas e chamar as funções desta lista.
 *
 * Sintaxe (estilo Excel pt-BR): números com vírgula ou ponto decimal; argumentos separados por ";";
 * operadores + - * / e comparações = <> < > <= >= (resultam em 1 ou 0).
 * Funções: min, max, arred(x; casas), piso, teto, abs, se(condição; então; senão).
 */

export class ErroExpressao extends Error {
  constructor(
    mensagem: string,
    readonly posicao: number,
  ) {
    super(`${mensagem} (posição ${posicao + 1})`);
    this.name = 'ErroExpressao';
  }
}

type No =
  | { t: 'num'; v: number }
  | { t: 'var'; nome: string; pos: number }
  | { t: 'neg'; a: No }
  | { t: 'bin'; op: string; a: No; b: No; pos: number }
  | { t: 'fn'; nome: string; args: No[]; pos: number };

interface Token {
  tipo: 'num' | 'id' | 'op' | 'fim';
  texto: string;
  pos: number;
}

const FUNCOES = new Map<string, { min: number; max: number; f: (a: number[]) => number }>([
  ['min', { min: 1, max: Infinity, f: (a) => Math.min(...a) }],
  ['max', { min: 1, max: Infinity, f: (a) => Math.max(...a) }],
  ['arred', { min: 1, max: 2, f: ([x, c = 0]) => Math.round(x! * 10 ** c) / 10 ** c }],
  ['piso', { min: 1, max: 1, f: ([x]) => Math.floor(x!) }],
  ['teto', { min: 1, max: 1, f: ([x]) => Math.ceil(x!) }],
  ['abs', { min: 1, max: 1, f: ([x]) => Math.abs(x!) }],
]);

const OPERADORES = ['<=', '>=', '<>', '+', '-', '*', '/', '(', ')', ';', '=', '<', '>'];

function tokenizar(texto: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < texto.length) {
    const c = texto[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const num = /^\d+(?:[.,]\d+)?/.exec(texto.slice(i));
    if (num) {
      tokens.push({ tipo: 'num', texto: num[0], pos: i });
      i += num[0].length;
      continue;
    }
    const id = /^[A-Za-z_][A-Za-z0-9_]*/.exec(texto.slice(i));
    if (id) {
      tokens.push({ tipo: 'id', texto: id[0], pos: i });
      i += id[0].length;
      continue;
    }
    const op = OPERADORES.find((o) => texto.startsWith(o, i));
    if (op) {
      tokens.push({ tipo: 'op', texto: op, pos: i });
      i += op.length;
      continue;
    }
    throw new ErroExpressao(`caractere inválido "${c}"`, i);
  }
  tokens.push({ tipo: 'fim', texto: '', pos: texto.length });
  return tokens;
}

function analisar(texto: string): No {
  if (!texto.trim()) throw new ErroExpressao('fórmula vazia', 0);
  const tokens = tokenizar(texto);
  let k = 0;
  const atual = () => tokens[k]!;
  const eh = (s: string) => atual().tipo === 'op' && atual().texto === s;
  const esperar = (s: string) => {
    if (!eh(s)) throw new ErroExpressao(`esperado "${s}"`, atual().pos);
    k++;
  };

  const expressao = (): No => comparacao();

  const comparacao = (): No => {
    const a = soma();
    const t = atual();
    if (t.tipo === 'op' && ['=', '<>', '<', '>', '<=', '>='].includes(t.texto)) {
      k++;
      return { t: 'bin', op: t.texto, a, b: soma(), pos: t.pos };
    }
    return a;
  };

  const soma = (): No => {
    let a = termo();
    while (eh('+') || eh('-')) {
      const t = tokens[k++]!;
      a = { t: 'bin', op: t.texto, a, b: termo(), pos: t.pos };
    }
    return a;
  };

  const termo = (): No => {
    let a = unario();
    while (eh('*') || eh('/')) {
      const t = tokens[k++]!;
      a = { t: 'bin', op: t.texto, a, b: unario(), pos: t.pos };
    }
    return a;
  };

  const unario = (): No => {
    if (eh('-')) {
      k++;
      return { t: 'neg', a: unario() };
    }
    if (eh('+')) {
      k++;
      return unario();
    }
    return primario();
  };

  const primario = (): No => {
    const t = atual();
    if (t.tipo === 'num') {
      k++;
      return { t: 'num', v: Number(t.texto.replace(',', '.')) };
    }
    if (t.tipo === 'id') {
      k++;
      if (!eh('(')) return { t: 'var', nome: t.texto, pos: t.pos };
      k++;
      const args: No[] = [];
      if (!eh(')')) {
        args.push(expressao());
        while (eh(';')) {
          k++;
          args.push(expressao());
        }
      }
      esperar(')');
      const nome = t.texto.toLowerCase();
      if (nome === 'se') {
        if (args.length !== 3) throw new ErroExpressao('se() precisa de 3 argumentos', t.pos);
      } else {
        const f = FUNCOES.get(nome);
        if (!f) throw new ErroExpressao(`função desconhecida: ${t.texto}`, t.pos);
        if (args.length < f.min || args.length > f.max) {
          throw new ErroExpressao(`número de argumentos inválido em ${t.texto}()`, t.pos);
        }
      }
      return { t: 'fn', nome, args, pos: t.pos };
    }
    if (eh('(')) {
      k++;
      const e = expressao();
      esperar(')');
      return e;
    }
    if (t.tipo === 'fim')
      throw new ErroExpressao('fórmula terminou no meio (fim inesperado)', t.pos);
    throw new ErroExpressao(`"${t.texto}" inesperado`, t.pos);
  };

  const raiz = expressao();
  if (atual().tipo !== 'fim') throw new ErroExpressao(`"${atual().texto}" inesperado`, atual().pos);
  return raiz;
}

function executar(no: No, vars: Readonly<Record<string, number>>): number {
  switch (no.t) {
    case 'num':
      return no.v;
    case 'var':
      if (!Object.hasOwn(vars, no.nome)) {
        throw new ErroExpressao(`variável desconhecida: ${no.nome}`, no.pos);
      }
      return vars[no.nome]!;
    case 'neg':
      return -executar(no.a, vars);
    case 'bin': {
      const a = executar(no.a, vars);
      const b = executar(no.b, vars);
      switch (no.op) {
        case '+':
          return a + b;
        case '-':
          return a - b;
        case '*':
          return a * b;
        case '/':
          if (b === 0) throw new ErroExpressao('divisão por zero', no.pos);
          return a / b;
        case '=':
          return a === b ? 1 : 0;
        case '<>':
          return a !== b ? 1 : 0;
        case '<':
          return a < b ? 1 : 0;
        case '>':
          return a > b ? 1 : 0;
        case '<=':
          return a <= b ? 1 : 0;
        default:
          return a >= b ? 1 : 0;
      }
    }
    case 'fn':
      if (no.nome === 'se') {
        const [c, entao, senao] = no.args as [No, No, No];
        return executar(c, vars) !== 0 ? executar(entao, vars) : executar(senao, vars);
      }
      return FUNCOES.get(no.nome)!.f(no.args.map((a) => executar(a, vars)));
  }
}

export interface Expressao {
  texto: string;
  /** Variáveis usadas, na ordem em que aparecem (sem repetição). */
  variaveis: string[];
  avaliar(vars: Readonly<Record<string, number>>): number;
}

export function compilar(texto: string): Expressao {
  const raiz = analisar(texto);
  const variaveis: string[] = [];
  const coletar = (n: No) => {
    if (n.t === 'var' && !variaveis.includes(n.nome)) variaveis.push(n.nome);
    if (n.t === 'neg') coletar(n.a);
    if (n.t === 'bin') {
      coletar(n.a);
      coletar(n.b);
    }
    if (n.t === 'fn') n.args.forEach(coletar);
  };
  coletar(raiz);
  return { texto, variaveis, avaliar: (vars) => executar(raiz, vars) };
}

export function avaliar(texto: string, vars: Readonly<Record<string, number>>): number {
  return compilar(texto).avaliar(vars);
}
