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

function numeroPreenchido(valor: unknown) {
  if (valor == null || valor === '') return false
  if (numeroSemCamisa(valor)) return true
  return inteiroOuNulo(valor) != null
}

function numeroPreenchidoNormalizado(valor: unknown): number | null {
  if (numeroSemCamisa(valor)) return NUMERO_SEM_CAMISA
  return inteiroOuNulo(valor)
}

function ultimaCamisaPreenchida(input: {
  jogadorId: number
  ligaId?: number | null
  partidaAtualId?: number | null
  anteriores?: CamisaAnterior[] | null
}): number | null {
  const candidatas = (input.anteriores ?? []).filter((item) => {
    if (Number(item.jogadorId) !== Number(input.jogadorId)) return false
    if (input.partidaAtualId != null && Number(item.partidaId) === Number(input.partidaAtualId)) return false
    if (input.ligaId != null && Number(item.ligaId) !== Number(input.ligaId)) return false
    return numeroPreenchido(item.numero)
  })
  if (!candidatas.length) return null
  let escolhida = candidatas[0]
  for (let indice = 1; indice < candidatas.length; indice += 1) {
    if (maisRecente(candidatas[indice], escolhida)) escolhida = candidatas[indice]
  }
  return numeroPreenchidoNormalizado(escolhida.numero)
}

function maisRecente(candidata: CamisaAnterior, atual: CamisaAnterior) {
  const dataCandidata = instante(candidata.dataHora)
  const dataAtual = instante(atual.dataHora)
  if ((dataCandidata != null) !== (dataAtual != null)) return dataCandidata != null
  if (dataCandidata != null && dataAtual != null && dataCandidata !== dataAtual) return dataCandidata > dataAtual
  if (Number(candidata.partidaId) !== Number(atual.partidaId)) return Number(candidata.partidaId) > Number(atual.partidaId)
  return Number(candidata.presencaId ?? 0) > Number(atual.presencaId ?? 0)
}

function instante(valor?: string | null) {
  if (valor == null || String(valor).trim() === '') return null
  const tempo = Date.parse(String(valor))
  return Number.isFinite(tempo) ? tempo : null
}

// SumulaPresenca.numero é o número desta partida. Sem ele, vale o cadastro.
export function numeroMvpDaLista(numeroCadastro: string, numeroDaPartida?: string | null) {
  const partida = numeroDaPartida == null ? '' : String(numeroDaPartida).trim()
  return partida || numeroCadastro
}

export type CamisaAnterior = {
  jogadorId: number
  partidaId: number
  ligaId?: number | null
  numero: unknown
  dataHora?: string | null
  presencaId?: number | null
}

/**
 * Número deste jogo, se já estiver gravado (inclusive 0 e -1).
 * Senão, a última camisa preenchida do atleta na mesma liga.
 * Senão, o cadastro. Não grava nada.
 */
export function numeroHerdado(input: {
  jogadorId: number
  ligaId?: number | null
  partidaAtualId?: number | null
  numeroCadastro?: unknown
  numeroDesteJogo?: unknown
  anteriores?: CamisaAnterior[] | null
}): number | null {
  if (numeroPreenchido(input.numeroDesteJogo)) return numeroPreenchidoNormalizado(input.numeroDesteJogo)
  const anterior = ultimaCamisaPreenchida(input)
  if (anterior != null) return anterior
  return inteiroOuNulo(input.numeroCadastro)
}

export function numeroSemCamisa(valor: unknown) {
  return valor === NUMERO_SEM_CAMISA || valor === MARCA_SEM_NUMERO || valor === '-1'
}

export function numeroNaPartida(
  atleta: { id: number; numero?: unknown; numeroHerdado?: unknown },
  presencas: PresencaNumeroPartida[],
): number | null {
  const registro = presencas.find((item) => Number(item.jogadorId) === Number(atleta.id))
  if (registro && numeroSemCamisa(registro.numero)) return null
  if (registro && registro.numero != null && registro.numero !== '') {
    const daPartida = inteiroOuNulo(registro.numero)
    if (daPartida === NUMERO_SEM_CAMISA) return null
    if (daPartida != null) return daPartida
  }
  if (atleta.numeroHerdado != null && atleta.numeroHerdado !== '') {
    if (numeroSemCamisa(atleta.numeroHerdado)) return null
    const herdado = inteiroOuNulo(atleta.numeroHerdado)
    if (herdado === NUMERO_SEM_CAMISA) return null
    if (herdado != null) return herdado
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
