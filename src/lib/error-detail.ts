export function errorDetail(err: unknown) {
  if (err instanceof Error) return err.message

  if (err && typeof err === 'object') {
    const record = err as Record<string, unknown>
    const parts = [record.message, record.details, record.hint, record.code]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)

    const safeParts = parts.filter((part) => !part.includes('Failing row contains'))
    if (safeParts.length > 0) return safeParts.join(' | ')

    try {
      const raw = JSON.stringify(record)
      if (raw.includes('Failing row contains')) return 'erro de banco'
      return raw
    } catch {
      return 'erro desconhecido'
    }
  }

  return String(err || 'erro desconhecido')
}
