export const NUMERO_CAMISA_MIN = 0
export const NUMERO_CAMISA_MAX = 99
/** Gravado em SumulaPresenca.numero. Null continua valendo o cadastro; este valor é camisa vazia. */
export const NUMERO_SEM_CAMISA = -1
export const MARCA_SEM_NUMERO = 'sem'

const MENSAGEM_FAIXA = 'O número da camisa deve ser um inteiro de 0 a 99.'

export type AtletaNumeroPartida = {
  id: number
  equipeId: number
  numero?: unknown
  nome?: string
}

export type AtribuicaoNumeroCamisa = {
  jogadorId: number
  numero: number | null
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
export function numeroMvpDaLista(numeroCadastro: string, numeroDaPartida?: string | null) {
  const partida = numeroDaPartida == null ? '' : String(numeroDaPartida).trim()
  return partida || numeroCadastro
}

export function numeroSemCamisa(valor: unknown) {
  return valor === NUMERO_SEM_CAMISA || valor === MARCA_SEM_NUMERO || valor === '-1'
}

export function numeroNaPartida(atleta: { id: number; numero?: unknown }, presencas: PresencaNumeroPartida[]): number | null {
  const registro = presencas.find((item) => Number(item.jogadorId) === Number(atleta.id))
  if (registro && numeroSemCamisa(registro.numero)) return null
  if (registro && registro.numero != null && registro.numero !== '') {
    const daPartida = inteiroOuNulo(registro.numero)
    if (daPartida === NUMERO_SEM_CAMISA) return null
    if (daPartida != null) return daPartida
  }
  return inteiroOuNulo(atleta.numero)
}

export function avisoPassagemDeCamisa(numero: number, destino: string, quemSaiu: string[]) {
  const nomes = quemSaiu.map((nome) => nome.trim() || 'Atleta')
  const recebedor = destino.trim() || 'Atleta'
  if (nomes.length === 1) return `Camisa ${numero} passou para ${recebedor}; ${nomes[0]} ficou sem número`
  return `Camisa ${numero} passou para ${recebedor}; ${nomes.join(', ')} ficaram sem número`
}

export function passagemDeNumeroCamisa(input: {
  jogadorId: number
  numero: unknown
  atletas: AtletaNumeroPartida[]
  presencas: PresencaNumeroPartida[]
}): { erro: string } | { atribuicoes: AtribuicaoNumeroCamisa[]; aviso: string | null } {
  const lido = interpretarNumeroCamisa(input.numero)
  if ('mensagem' in lido) return { erro: lido.mensagem }

  const atleta = input.atletas.find((item) => Number(item.id) === Number(input.jogadorId))
  if (!atleta) return { erro: 'Este atleta não joga esta partida.' }

  const quemTinha = input.atletas.filter((outro) => {
    if (Number(outro.id) === Number(atleta.id)) return false
    if (Number(outro.equipeId) !== Number(atleta.equipeId)) return false
    return numeroNaPartida(outro, input.presencas) === lido.numero
  })

  const atribuicoes: AtribuicaoNumeroCamisa[] = [
    ...quemTinha.map((outro) => ({ jogadorId: Number(outro.id), numero: null })),
    { jogadorId: Number(atleta.id), numero: lido.numero },
  ]
  const aviso = quemTinha.length
    ? avisoPassagemDeCamisa(lido.numero, String(atleta.nome ?? ''), quemTinha.map((outro) => String(outro.nome ?? '')))
    : null
  return { atribuicoes, aviso }
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
  return null
}
