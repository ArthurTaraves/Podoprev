// Datas do app num lugar só, sempre em HORÁRIO LOCAL.
//
// Por que existe: `new Date('2026-11-07')` (string ISO sem horário) é lido como
// meia-noite UTC — no Brasil (UTC-3) isso é 21h do dia anterior, então a data
// aparece um dia antes. E `toISOString().slice(0, 10)` faz o caminho inverso:
// depois das 21h já devolve o dia seguinte. Toda data "de calendário" (yyyy-mm-dd)
// do app passa por aqui para nunca cair nesses dois casos.

export type DateInput = string | number | Date;

// "yyyy-mm-dd" → Date à meia-noite local.
export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function toDate(date: DateInput): Date {
  if (date instanceof Date) return date;
  if (typeof date === 'number') return new Date(date);
  return parseIsoDate(date);
}

// Date/timestamp → "yyyy-mm-dd" no dia local (nunca UTC).
export function toIsoDate(date: DateInput): string {
  const d = toDate(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

// "yyyy-mm-dd" + n dias (n pode ser negativo).
export function addDaysIso(iso: string, days: number): string {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

// Dias de calendário de dateA até dateB (dateB − dateA): positivo se B é depois.
// Usa Date.UTC só como régua aritmética sobre ano/mês/dia já locais — assim uma
// virada de horário de verão no meio do intervalo não desloca o resultado.
export function daysBetween(dateA: string, dateB: string): number {
  const [ay, am, ad] = dateA.split('-').map(Number);
  const [by, bm, bd] = dateB.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

// "dd/mm/aaaa". Aceita "yyyy-mm-dd" (lido como data local), timestamp ou Date.
export function formatDateBR(date: DateInput, options?: Intl.DateTimeFormatOptions): string {
  return toDate(date).toLocaleDateString('pt-BR', options);
}
