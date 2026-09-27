import type { ZodError } from 'zod'

const FIELD_LABELS: Record<string, string> = {
  dataInicio: 'Data de início',
  dataFim: 'Data de término',
  nome: 'Nome do local',
  endereco: 'Endereço',
  quadra: 'Quadra',
  ordem: 'Ordem',
}

export function describeSchemaError(schemaError: ZodError) {
  const fieldErrors = schemaError.flatten().fieldErrors
  const fields = Object.keys(fieldErrors)
  const messages = fields.map((field) => {
    const label = FIELD_LABELS[field] ?? field
    const raw = fieldErrors[field]?.[0] ?? ''
    if (raw === 'Invalid datetime') return `${label} precisa ser uma data válida.`
    if (raw === 'Required' || /at least 1 character/i.test(raw)) return `Preencha ${label}.`
    return raw ? `${label}: ${raw}` : `Revise ${label}.`
  })
  return { fields, messages }
}
