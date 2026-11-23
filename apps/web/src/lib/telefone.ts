/** Só os dígitos, sem o 55 do Brasil quando vier com ele (até 11 dígitos: DDD + número). */
export function digitosTelefone(v: string): string {
  let d = v.replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  return d.slice(0, 11);
}

/** (45) 99999-9999 ou (45) 3333-4444 conforme vai digitando. */
export function formatarTelefone(v: string): string {
  const d = digitosTelefone(v);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  const corte = resto.length === 9 ? 5 : 4;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}
