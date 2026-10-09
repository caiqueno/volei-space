type Balde = { contagem: number; reiniciaEm: number }

const baldes = new Map<string, Balde>()
const LIMITE_BALDES = 5000

export type ResultadoCota = { permitido: boolean; retryAfterSeconds: number }

export function consumirCota(chave: string, limite: number, janelaMs: number, agora = Date.now()): ResultadoCota {
  limparExpirados(agora)
  const atual = baldes.get(chave)
  if (!atual || atual.reiniciaEm <= agora) {
    baldes.set(chave, { contagem: 1, reiniciaEm: agora + janelaMs })
    return { permitido: true, retryAfterSeconds: 0 }
  }
  if (atual.contagem >= limite) {
    return { permitido: false, retryAfterSeconds: Math.max(1, Math.ceil((atual.reiniciaEm - agora) / 1000)) }
  }
  atual.contagem += 1
  return { permitido: true, retryAfterSeconds: 0 }
}

export function ipDaRequisicao(req: { headers: { get(nome: string): string | null } }) {
  const encaminhado = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const real = req.headers.get('x-real-ip')?.trim()
  return (encaminhado || real || 'desconhecido').slice(0, 80)
}

export function reiniciarCotas() {
  baldes.clear()
}

function limparExpirados(agora: number) {
  if (baldes.size < LIMITE_BALDES) return
  const expiradas: string[] = []
  baldes.forEach((balde, chave) => {
    if (balde.reiniciaEm <= agora) expiradas.push(chave)
  })
  expiradas.forEach((chave) => baldes.delete(chave))
}
