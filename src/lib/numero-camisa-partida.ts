export const NUMERO_CAMISA_MIN = 0
export const NUMERO_CAMISA_MAX = 99

const MENSAGEM_FAIXA = 'O número da camisa deve ser um inteiro de 0 a 99.'
const MENSAGEM_REPETIDO = 'Já existe um atleta com esse número nesta equipe nesta partida.'

export type AtletaNumeroPartida = {
  id: number
  equipeId: number
  numero?: unknown
}

export type PresencaNumeroPartida = {
  jogadorId: number
  equipeId?: number
  numero?: unknown
  presente?: boolean | null
}

export function proximoAtletaNoElenco<T extends { id: number }>(elenco: readonly T[], jogadorId: number): T | null {
  const index = elenco.findIndex((item) => Number(item.id) === Number(jogadorId))
  if (index < 0) return null
  return elenco[index + 1] ?? null
}

export function presencaFoiDecidida(presenca: { presente?: boolean | null } | null | undefined) {
  return presenca?.presente === true || presenca?.presente === false
}

function inteiroOuNulo(valor: unknown): number | null {
  if (typeof valor === 'number' && Number.isInteger(valor)) return valor
  if (typeof valor === 'string' && /^\d+$/.test(valor.trim())) return Number(valor.trim())
  return null
}

// SumulaPresenca.numero é o número desta partida. Sem ele, vale o cadastro.
export function numeroNaPartida(atleta: { id: number; numero?: unknown }, presencas: PresencaNumeroPartida[]): number | null {
  const registro = presencas.find((item) => Number(item.jogadorId) === Number(atleta.id))
  if (registro && registro.numero != null && registro.numero !== '') {
    const daPartida = inteiroOuNulo(registro.numero)
    if (daPartida != null) return daPartida
  }
  return inteiroOuNulo(atleta.numero)
}

export function interpretarNumeroCamisa(valor: unknown): { numero: number } | { mensagem: string } {
  if (typeof valor === 'string') {
    const texto = valor.trim()
    if (!/^\d{1,2}$/.test(texto)) return { mensagem: MENSAGEM_FAIXA }
    return { numero: Number(texto) }
  }
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < NUMERO_CAMISA_MIN || valor > NUMERO_CAMISA_MAX) {
    return { mensagem: MENSAGEM_FAIXA }
  }
  return { numero: valor }
}

export function validarTrocaNumeroCamisa(input: {
  jogadorId: number
  numero: unknown
  atletas: AtletaNumeroPartida[]
  presencas: PresencaNumeroPartida[]
}): string | null {
  if (input.numero == null || input.numero === '') return null
  const lido = interpretarNumeroCamisa(input.numero)
  if ('mensagem' in lido) return lido.mensagem

  const atleta = input.atletas.find((item) => Number(item.id) === Number(input.jogadorId))
  if (!atleta) return 'Este atleta não joga esta partida.'

  const duplicado = input.atletas.some((outro) => {
    if (Number(outro.id) === Number(atleta.id)) return false
    if (Number(outro.equipeId) !== Number(atleta.equipeId)) return false
    return numeroNaPartida(outro, input.presencas) === lido.numero
  })
  return duplicado ? MENSAGEM_REPETIDO : null
}
