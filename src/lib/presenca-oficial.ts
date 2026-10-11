import { numeroNaPartida } from '@/lib/numero-camisa-partida'
import { numerosDaTroca } from '@/lib/sumula-regras'

export const MENSAGEM_MINIMO_ATLETAS = 'A súmula oficial exige pelo menos 6 atletas validados por equipe.'

export type AtletaDaSumula = {
  id: number
  equipeId: number
  numero?: unknown
}

export type PresencaDaSumula = {
  jogadorId: number
  equipeId?: number
  presente?: boolean | null
  numero?: unknown
}

export type OcorrenciaDaSumula = {
  id?: number | null
  tipo?: string | null
  descricao?: string | null
  set?: number | null
  jogadorId?: number | null
}

export type EquipeDaSumula = {
  id: number
  nome?: string | null
}

/**
 * Quem foi marcado presente, quem entrou em alguma escalação gravada na súmula
 * ou quem entrou por substituição conta para o mínimo de 6. Pendente e ausência
 * sem essas marcas não contam. A camisa da partida não substitui o cadastro na
 * escalação: o marcador de rotação guarda o número do elenco.
 */
export function idsPresentesNaSumula(input: {
  equipeAId: number
  equipeBId: number
  equipes?: EquipeDaSumula[]
  atletas: AtletaDaSumula[]
  presencas?: PresencaDaSumula[] | null
  ocorrencias?: OcorrenciaDaSumula[] | null
}) {
  const presentes = new Map<number, Set<number>>([
    [Number(input.equipeAId), new Set<number>()],
    [Number(input.equipeBId), new Set<number>()],
  ])
  const atletas = input.atletas ?? []
  const presencas = input.presencas ?? []
  const equipes = input.equipes ?? []

  function marcar(equipeId: number, jogadorId: number) {
    if (!Number.isFinite(equipeId) || !Number.isFinite(jogadorId)) return
    presentes.get(equipeId)?.add(jogadorId)
  }

  for (const presenca of presencas) {
    if (presenca.presente !== true) continue
    const atleta = atletas.find((item) => Number(item.id) === Number(presenca.jogadorId))
    if (!atleta) continue
    marcar(Number(atleta.equipeId), Number(atleta.id))
  }

  for (const ocorrencia of input.ocorrencias ?? []) {
    const descricao = String(ocorrencia.descricao ?? '')
    const rotacao = /\[\[ROT:\d+:(?:teamA|teamB):([^:\]]*):([^\]]*)\]\]/g
    let marcador: RegExpExecArray | null = rotacao.exec(descricao)
    while (marcador) {
      numerosDaLista(marcador[1]).forEach((numero) => {
        const id = atletaDoNumero(input.equipeAId, numero, atletas, presencas, 'cadastro')
        if (id != null) marcar(input.equipeAId, id)
      })
      numerosDaLista(marcador[2]).forEach((numero) => {
        const id = atletaDoNumero(input.equipeBId, numero, atletas, presencas, 'cadastro')
        if (id != null) marcar(input.equipeBId, id)
      })
      marcador = rotacao.exec(descricao)
    }

    if (!entrouEmSubstituicao(ocorrencia.tipo)) continue
    const troca = numerosDaTroca(descricao)
    if (!troca) continue
    const equipeId = equipeMencionada(descricao, equipes)
    const id = idDeQuemEntrou(troca[1], equipeId, input.equipeAId, input.equipeBId, atletas, presencas)
    if (id == null) continue
    const atleta = atletas.find((item) => Number(item.id) === id)
    if (atleta) marcar(Number(atleta.equipeId), id)
  }

  return presentes
}

export function motivoMinimoAtletas(input: {
  equipeAId: number
  equipeBId: number
  equipes?: EquipeDaSumula[]
  atletas: AtletaDaSumula[]
  presencas?: PresencaDaSumula[] | null
  ocorrencias?: OcorrenciaDaSumula[] | null
}) {
  const presentes = idsPresentesNaSumula(input)
  const totalA = presentes.get(Number(input.equipeAId))?.size ?? 0
  const totalB = presentes.get(Number(input.equipeBId))?.size ?? 0
  if (totalA < 6 || totalB < 6) return MENSAGEM_MINIMO_ATLETAS
  return null
}

/** Validado grava true. Ausência explícita grava false. O resto fica pendente, nunca false. */
export function presenteNoPayload(jogadorId: number, validados: readonly number[], ausentes: readonly number[]): boolean | null {
  if (validados.includes(jogadorId)) return true
  if (ausentes.includes(jogadorId)) return false
  return null
}

/** A ausência explícita é o registro da rota de presença. False sem esse texto não é ausência. */
export function ausenteExplicito(
  jogadorId: number,
  ocorrencias: Array<{ id?: number | null; descricao?: string | null }>,
) {
  const marca = new RegExp(`atleta ${Number(jogadorId)} (confirmado|ausente)\\b`)
  let ultimo: 'ausente' | 'confirmado' | null = null
  const ordenadas = [...ocorrencias].sort((a, b) => Number(a.id ?? 0) - Number(b.id ?? 0))
  for (const item of ordenadas) {
    const achou = String(item.descricao ?? '').match(marca)
    if (!achou) continue
    ultimo = achou[1] === 'ausente' ? 'ausente' : 'confirmado'
  }
  return ultimo === 'ausente'
}

function idDeQuemEntrou(
  numero: string,
  equipeId: number | null,
  equipeAId: number,
  equipeBId: number,
  atletas: AtletaDaSumula[],
  presencas: PresencaDaSumula[],
) {
  if (equipeId != null) return atletaDoNumero(equipeId, numero, atletas, presencas, 'sumula')
  const noA = atletaDoNumero(equipeAId, numero, atletas, presencas, 'sumula')
  const noB = atletaDoNumero(equipeBId, numero, atletas, presencas, 'sumula')
  if (noA != null && noB == null) return noA
  if (noB != null && noA == null) return noB
  return null
}

function atletaDoNumero(
  equipeId: number,
  token: string,
  atletas: AtletaDaSumula[],
  presencas: PresencaDaSumula[],
  modo: 'cadastro' | 'sumula',
) {
  const texto = token.trim()
  if (!texto) return null
  const daEquipe = atletas.filter((item) => Number(item.equipeId) === Number(equipeId))
  const porCadastro = daEquipe.filter((item) => mesmoNumero(item.numero, texto))
  const porSumula = daEquipe.filter((item) => numeroNaPartida({ id: item.id, numero: item.numero }, presencas) === Number(texto))
  const escolhidos = modo === 'cadastro'
    ? (porCadastro.length ? porCadastro : porSumula)
    : (porSumula.length ? porSumula : porCadastro)
  if (!escolhidos.length) return null
  return [...escolhidos].sort((a, b) => Number(a.id) - Number(b.id))[0].id
}

function numerosDaLista(valor: string) {
  return valor.split(',').map((item) => item.trim()).filter(Boolean)
}

function entrouEmSubstituicao(tipo: string | null | undefined) {
  const normalizado = String(tipo ?? '').trim().toLowerCase()
  return normalizado === 'substitution'
    || normalizado === 'substituicao'
    || normalizado === 'lesao'
    || normalizado === 'injury_substitution'
    || normalizado === 'troca_libero'
    || normalizado === 'libero_exchange'
}

function equipeMencionada(descricao: string, equipes: EquipeDaSumula[]) {
  const texto = normalizar(descricao)
  const encontradas = equipes.filter((equipe) => equipe.nome && texto.includes(normalizar(equipe.nome)))
  if (!encontradas.length) return null
  encontradas.sort((a, b) => normalizar(b.nome).length - normalizar(a.nome).length)
  return Number(encontradas[0].id)
}

function mesmoNumero(valor: unknown, texto: string) {
  if (valor == null || valor === '') return false
  if (String(valor).trim() === texto) return true
  const numero = Number(texto)
  return Number.isFinite(numero) && Number(valor) === numero
}

function normalizar(valor?: string | null) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}
