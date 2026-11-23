import 'server-only';
import type { Borda, OrigemTipo } from '@pro-cutter/promob';
import type { ParametroRegra, TipoModulo } from '@pro-cutter/regras';
import type { PrismaDaEmpresa } from '@pro-cutter/db';

export interface ConfigImportacaoSalva {
  mapaGrupos: Record<string, string>;
  origemPorTipo: Record<string, OrigemTipo>;
  ladosFita: [Borda, Borda, Borda, Borda];
}

export interface Etiqueta {
  largura: number;
  altura: number;
}

export interface ConfiguracaoTipada {
  id: string;
  versao: number;
  regras: ParametroRegra[];
  tiposModulo: TipoModulo[];
  importacao: ConfigImportacaoSalva;
  etiqueta: Etiqueta;
}

/** Lê a configuração da empresa já com os tipos dos campos JSON. */
export async function lerConfiguracao(db: PrismaDaEmpresa): Promise<ConfiguracaoTipada> {
  const c = await db.configuracao.findFirstOrThrow();
  return {
    id: c.id,
    versao: c.versao,
    regras: c.regras as unknown as ParametroRegra[],
    tiposModulo: c.tiposModulo as unknown as TipoModulo[],
    importacao: c.importacao as unknown as ConfigImportacaoSalva,
    etiqueta: c.etiqueta as unknown as Etiqueta,
  };
}
