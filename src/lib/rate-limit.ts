type Balde = { count: number; resetAt: number }

const baldes = new Map<string, Balde>()

export function limparLimites() {
  baldes.clear()
}

export function ipDaRequisicao(req: { headers: { get(name: string): string | null } }) {
  const encaminhado = req.headers.get('x-forwarded-for')
  const primeiro = encaminhado?.split(',')[0]?.trim()
  if (primeiro) return primeiro.slice(0, 80)
  const real = req.headers.get('x-real-ip')?.trim()
  return real ? real.slice(0, 80) : 'desconhecido'
}

export function consumirLimite(chave: string, limite: number, janelaMs: number, agora = Date.now()) {
  if (baldes.size > 5000) {
    baldes.forEach((balde, nome) => {
      if (balde.resetAt <= agora) baldes.delete(nome)
    })
  }

  const atual = baldes.get(chave)
  if (!atual || atual.resetAt <= agora) {
    baldes.set(chave, { count: 1, resetAt: agora + janelaMs })
    return { ok: true as const, retryAfterSeconds: 0 }
  }
  if (atual.count >= limite) {
    return { ok: false as const, retryAfterSeconds: Math.max(1, Math.ceil((atual.resetAt - agora) / 1000)) }
  }
  atual.count += 1
  return { ok: true as const, retryAfterSeconds: 0 }
}
