// Conversão entre os formatos de <input type="date"/datetime-local"> (hora
// local, sem timezone) e o ISO 8601 completo que os schemas Zod de setup
// exigem (`z.string().datetime()`).
//
// Fuso fixado em -03:00 (Brasil não observa horário de verão desde 2019) —
// mesma convenção já usada em src/app/api/organizador/ligas/[id]/estrutura/route.ts
// (buildSaoPauloDateTime).
//
// NUNCA use `date.toISOString().slice(0, 10)` para o caminho inverso: ele
// projeta em UTC, não em America/Sao_Paulo, e desloca a data em +1 dia
// sempre que o horário salvo cai entre 21h e 23h59 local (é exatamente o bug
// hoje presente em src/app/painel/page.tsx::toDateInputValue).

const BR_OFFSET = '-03:00'

function isValidIso(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime())
}

/** Qualquer texto de data que o JS entenda vira ISO com `Z`. Texto inválido volta `null`. */
export function coerceIsoDate(value: string): string | null {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

/** `YYYY-MM-DD` (de <input type="date">) -> ISO 8601, início do dia em BRT. */
export function dateInputToIsoStart(value: string): string | null {
  if (!value) return null
  const iso = new Date(`${value}T00:00:00${BR_OFFSET}`).toISOString()
  return isValidIso(iso) ? iso : null
}

/** `YYYY-MM-DD` (de <input type="date">) -> ISO 8601, fim do dia em BRT. */
export function dateInputToIsoEnd(value: string): string | null {
  if (!value) return null
  const iso = new Date(`${value}T23:59:59${BR_OFFSET}`).toISOString()
  return isValidIso(iso) ? iso : null
}

/** ISO 8601 -> `YYYY-MM-DD` no fuso de São Paulo (não UTC). */
export function isoToDateInput(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  // en-CA formata como YYYY-MM-DD — é o único locale nativo que já devolve
  // nesse formato sem parsing adicional.
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

/** `YYYY-MM-DDTHH:mm` (de <input type="datetime-local">) -> ISO 8601 em BRT. */
export function dateTimeLocalToIso(value: string): string | null {
  if (!value) return null
  const iso = new Date(`${value}:00${BR_OFFSET}`).toISOString()
  return isValidIso(iso) ? iso : null
}

/** ISO 8601 -> `YYYY-MM-DDTHH:mm` no fuso de São Paulo, para datetime-local. */
export function isoToDateTimeLocal(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

/** Formata um ISO para exibição curta em pt-BR (dd/mm/aaaa), fuso São Paulo. */
export function formatDateBr(value?: string | null): string {
  if (!value) return 'A definir'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'A definir'
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}
