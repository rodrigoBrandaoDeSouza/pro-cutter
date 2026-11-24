/** Cabeçalho padrão das páginas: título, descrição e a ação principal à direita. */
export function Cabecalho({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b px-4 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>}
      </div>
      {acao}
    </div>
  );
}

/** Estado vazio que orienta o próximo passo. */
export function EstadoVazio({
  icone,
  titulo,
  descricao,
  acao,
}: {
  icone: React.ReactNode;
  titulo: string;
  descricao: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary [&_svg]:size-7">
        {icone}
      </div>
      <h2 className="text-lg font-semibold">{titulo}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
      {acao && <div className="mt-6">{acao}</div>}
    </div>
  );
}
