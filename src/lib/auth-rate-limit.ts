type RateLimiterOptions = {
  limit: number
  windowMs: number
}

export function createRateLimiter({ limit, windowMs }: RateLimiterOptions) {
  const hits = new Map<string, number[]>()

  return {
    permitir(chave: string, agora = Date.now()) {
      const inicio = agora - windowMs
      const recentes = (hits.get(chave) ?? []).filter((instante) => instante > inicio)
      if (recentes.length >= limit) {
        hits.set(chave, recentes)
        return false
      }
      recentes.push(agora)
      hits.set(chave, recentes)
      if (hits.size > 5000) {
        hits.forEach((values, key) => {
          if (values.every((instante: number) => instante <= inicio)) hits.delete(key)
        })
      }
      return true
    },
  }
}

export const loginRateLimiter = createRateLimiter({ limit: 20, windowMs: 10 * 60 * 1000 })
