export const MENSAGEM_NUMERO_REPETIDO = 'Este número já está sendo utilizado por outro atleta desta equipe.'
export const MENSAGEM_CAMISA_NOVA = 'O número da camisa deve ser um inteiro de 0 a 99.'

/** Partida que já saiu do agendamento. A sugestão não usa jogo futuro nem cancelado. */
export const STATUS_EQUIPE_JOGOU = ['EM_ANDAMENTO', 'ENCERRADA', 'WO', 'FINALIZADA', 'APROVADA'] as const

export type PartidaDaEquipe = {
  id: number
  equipeAId: number
  equipeBId: number
  ligaId: number
  dataHora?: string | null
  status?: string | null
}

export type PresencaNaPartida = {
  partidaId: number
  jogadorId: number
  equipeId: number
  presente?: boolean | null
}

export type AtletaDoElenco = {
  id?: number
  equipeId?: number
  numero?: unknown
  banido?: boolean | null
}

function instante(valor?: string | null) {
  if (valor == null || String(valor).trim() === '') return null
  const tempo = Date.parse(String(valor))
  return Number.isFinite(tempo) ? tempo : null
}

function partidaMaisRecente(candidata: PartidaDaEquipe, atual: PartidaDaEquipe) {
  const dataCandidata = instante(candidata.dataHora)
  const dataAtual = instante(atual.dataHora)
  if ((dataCandidata != null) !== (dataAtual != null)) return dataCandidata != null
  if (dataCandidata != null && dataAtual != null && dataCandidata !== dataAtual) return dataCandidata > dataAtual
  return Number(candidata.id) > Number(atual.id)
}

function equipeJogou(status?: string | null) {
  return STATUS_EQUIPE_JOGOU.includes(String(status ?? '').trim().toUpperCase() as (typeof STATUS_EQUIPE_JOGOU)[number])
}

export function ultimaPartidaDaEquipe(input: {
  equipeId: number
  ligaId: number
  partidaAtualId: number
  partidas: PartidaDaEquipe[]
}): PartidaDaEquipe | null {
  const candidatas = input.partidas.filter((partida) => {
    if (Number(partida.ligaId) !== Number(input.ligaId)) return false
    if (Number(partida.id) === Number(input.partidaAtualId)) return false
    const joga = Number(partida.equipeAId) === Number(input.equipeId) || Number(partida.equipeBId) === Number(input.equipeId)
    return joga && equipeJogou(partida.status)
  })
  if (!candidatas.length) return null
  return candidatas.reduce((melhor, atual) => (partidaMaisRecente(atual, melhor) ? atual : melhor))
}

/** Presença do atleta na última partida da equipe. Não olha jogo mais antigo. */
export function presencaHerdadaDoAtleta(input: {
  jogadorId: number
  equipeId: number
  ultimaPartidaId: number | null
  presencas: PresencaNaPartida[]
}): boolean | null {
  if (input.ultimaPartidaId == null) return null
  const linha = input.presencas.find((item) => (
    Number(item.partidaId) === Number(input.ultimaPartidaId)
    && Number(item.jogadorId) === Number(input.jogadorId)
    && Number(item.equipeId) === Number(input.equipeId)
  ))
  if (!linha) return null
  if (linha.presente === true || linha.presente === false) return linha.presente
  return null
}

/** O que a tela mostra. Decisão deste jogo fica por cima da sugestão. */
export function presencaNaTela(input: {
  presenteDesteJogo?: boolean | null
  presencaHerdada?: boolean | null
}): boolean | null {
  if (input.presenteDesteJogo === true || input.presenteDesteJogo === false) return input.presenteDesteJogo
  if (input.presencaHerdada === true || input.presencaHerdada === false) return input.presencaHerdada
  return null
}

function numeroDoElenco(valor: unknown): number | null {
  if (typeof valor === 'number' && Number.isInteger(valor)) return valor
  if (typeof valor === 'string' && /^\d{1,2}$/.test(valor.trim())) return Number(valor.trim())
  return null
}

export function validarNovoAtleta(input: {
  nome: string
  numero: string
  atletas: AtletaDoElenco[]
  equipeId?: number
}): { nome: string; numero: number } | { erro: string } {
  const nome = input.nome.trim()
  if (!nome) return { erro: 'Informe o nome do atleta.' }
  const texto = input.numero.trim()
  if (!/^\d{1,2}$/.test(texto)) return { erro: MENSAGEM_CAMISA_NOVA }
  const numero = Number(texto)
  const repetido = input.atletas.some((atleta) => {
    if (atleta.banido === true) return false
    if (input.equipeId != null && atleta.equipeId != null && Number(atleta.equipeId) !== Number(input.equipeId)) return false
    return numeroDoElenco(atleta.numero) === numero
  })
  if (repetido) return { erro: MENSAGEM_NUMERO_REPETIDO }
  return { nome, numero }
}

/** Corpo do INSERT. Não leva id nem campo de atualização. */
export function payloadNovoAtleta(entrada: { nome: string; equipeId: number; numero: number }) {
  return {
    nome: entrada.nome,
    equipeId: entrada.equipeId,
    numero: entrada.numero,
  }
}
