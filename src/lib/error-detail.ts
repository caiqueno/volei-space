export function errorDetail(err: unknown) {
  if (err instanceof Error) return err.message

  if (err && typeof err === 'object') {
    const record = err as Record<string, unknown>
    const parts = [record.message, record.details, record.hint, record.code]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)

    if (parts.length > 0) return parts.join(' | ')

    try {
      return JSON.stringify(record)
    } catch {
      return 'erro desconhecido'
    }
  }

  return String(err || 'erro desconhecido')
}
