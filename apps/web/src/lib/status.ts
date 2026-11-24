export const STATUS = [
  'ORCAMENTO',
  'APROVADO',
  'EM_CORTE',
  'CORTADO',
  'ENTREGUE',
  'CANCELADO',
] as const;
export type Status = (typeof STATUS)[number];

export const ROTULO_STATUS: Record<Status, string> = {
  ORCAMENTO: 'Orçamento',
  APROVADO: 'Aprovado',
  EM_CORTE: 'Em corte',
  CORTADO: 'Cortado',
  ENTREGUE: 'Entregue',
  CANCELADO: 'Cancelado',
};

/** Classes do selo de cada status (claro e escuro). */
export const COR_STATUS: Record<Status, string> = {
  ORCAMENTO: 'bg-muted text-muted-foreground',
  APROVADO: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  EM_CORTE: 'bg-primary/15 text-primary',
  CORTADO: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  ENTREGUE: 'bg-success/15 text-success',
  CANCELADO: 'bg-destructive/10 text-destructive line-through decoration-1',
};
