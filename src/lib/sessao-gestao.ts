export const INATIVIDADE_GESTAO_SEGUNDOS = 2 * 60 * 60
export const INATIVIDADE_GESTAO_MS = INATIVIDADE_GESTAO_SEGUNDOS * 1000

export function marcaAtividadeSegundos(payload: object) {
  const registro = payload as { act?: unknown; iat?: unknown }
  const act = Number(registro.act)
  if (Number.isFinite(act) && act > 0) return act
  const iat = Number(registro.iat)
  if (Number.isFinite(iat) && iat > 0) return iat
  return null
}

export function sessaoGestaoExpirada(payload: object | null | undefined, agoraSegundos = Math.floor(Date.now() / 1000)) {
  if (!payload) return true
  const marca = marcaAtividadeSegundos(payload)
  if (marca == null) return true
  return agoraSegundos - marca >= INATIVIDADE_GESTAO_SEGUNDOS
}

export function nomeDaSessao(nome?: string | null, email?: string | null) {
  const pessoa = typeof nome === 'string' ? nome.trim() : ''
  if (pessoa) return pessoa
  return typeof email === 'string' ? email.trim() : ''
}

export function saudacaoSessao(nome?: string | null, email?: string | null) {
  const quem = nomeDaSessao(nome, email)
  return quem ? `Bem-vindo, ${quem}` : ''
}

export function caminhoIsentoDeInatividade(pathname: string) {
  return pathname === '/sumula'
    || pathname.startsWith('/sumula/')
    || pathname === '/arbitro'
    || pathname.startsWith('/arbitro/')
    || pathname === '/api/sumula'
    || pathname.startsWith('/api/sumula/')
    || pathname === '/api/arbitro'
    || pathname.startsWith('/api/arbitro/')
}
