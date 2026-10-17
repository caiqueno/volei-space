/**
 * Validação LOCAL da papeleta (retorno rápido na tela). O servidor valida de novo: esta checagem nunca substitui a dele.
 * Reaproveita o motor de regras (relação nominal e líberos).
 */
import { validarEntradaEmQuadra, validarRegistroDeLiberos } from '../regras-volei'
import type { JogadorBanco, PapeletaBanco, RascunhoPapeleta, Violacao } from './tipos'

/** Ordem de leitura da quadra, de frente para a rede: IV III II (frente) e V VI I (fundo). */
export const ORDEM_QUADRA: readonly number[] = [4, 3, 2, 5, 6, 1]
export const NUMERAL_POSICAO: Readonly<Record<number, string>> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI' }
export const POSICOES: readonly number[] = [1, 2, 3, 4, 5, 6]

export function rascunhoVazio(): RascunhoPapeleta {
  return { slots: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null }, liberoId: null, capitaoId: null }
}

export function rascunhoDaPapeleta(p: PapeletaBanco | undefined | null): RascunhoPapeleta {
  const r = rascunhoVazio()
  if (!p) return r
  for (const s of p.formacao) {
    if (s.posicao >= 1 && s.posicao <= 6) r.slots[s.posicao] = s.jogadorId
  }
  r.liberoId = p.liberoId ?? null
  r.capitaoId = p.capitaoId ?? null
  return r
}

export function titulares(r: RascunhoPapeleta): number[] {
  return POSICOES.map((p) => r.slots[p]).filter((j): j is number => typeof j === 'number')
}

export function formacaoCompleta(r: RascunhoPapeleta): boolean {
  return titulares(r).length === 6
}

/** Coloca o jogador na posição; se ele já estava em outra posição, as duas trocam; se era líbero, deixa de ser. */
export function colocarJogador(r: RascunhoPapeleta, posicao: number, jogadorId: number | null): RascunhoPapeleta {
  const slots = { ...r.slots }
  if (jogadorId !== null) {
    const outra = POSICOES.find((p) => p !== posicao && slots[p] === jogadorId)
    if (outra !== undefined) slots[outra] = slots[posicao] ?? null
  }
  slots[posicao] = jogadorId
  return { ...r, slots, liberoId: jogadorId !== null && r.liberoId === jogadorId ? null : r.liberoId }
}

export function definirLibero(r: RascunhoPapeleta, jogadorId: number | null): RascunhoPapeleta {
  return { ...r, liberoId: jogadorId }
}

export function definirCapitao(r: RascunhoPapeleta, jogadorId: number | null): RascunhoPapeleta {
  return { ...r, capitaoId: jogadorId }
}

/** Corpo do PUT. Só existe quando as 6 posições estão preenchidas. */
export function corpoDaPapeleta(r: RascunhoPapeleta): {
  formacao: { posicao: number; jogadorId: number }[]
  liberoId?: number
  capitaoId?: number
} | null {
  if (!formacaoCompleta(r)) return null
  const corpo: { formacao: { posicao: number; jogadorId: number }[]; liberoId?: number; capitaoId?: number } = {
    formacao: POSICOES.map((posicao) => ({ posicao, jogadorId: r.slots[posicao] as number })),
  }
  if (r.liberoId !== null) corpo.liberoId = r.liberoId
  if (r.capitaoId !== null) corpo.capitaoId = r.capitaoId
  return corpo
}

export function rotuloJogador(j: JogadorBanco | undefined): string {
  if (!j) return 'Jogador'
  return j.numero !== null && j.numero !== undefined ? `${j.numero} · ${j.nome}` : j.nome
}

export interface ResultadoValidacao {
  violacoes: Violacao[]
  /** Posições ainda vazias (não é erro de regra, só falta preencher). */
  faltando: number[]
  /** Pode enviar: nada faltando e nenhuma violação. */
  pronta: boolean
}

/**
 * Regras checadas: 6 titulares distintos (RG-FOR-005), todos da relação nominal (RG-FOR-009 / RG-ELE-002),
 * líbero da relação nominal e fora dos 6 titulares (RG-LIB-001 / RG-LIB-003), capitão da relação nominal e não líbero (RG-ELE-005).
 */
export function validarFormacaoLocal(r: RascunhoPapeleta, elenco: readonly JogadorBanco[]): ResultadoValidacao {
  const ids = elenco.map((j) => j.jogadorId)
  const violacoes: Violacao[] = []
  const faltando = POSICOES.filter((p) => r.slots[p] === null || r.slots[p] === undefined)
  const nomeDe = (id: number) => elenco.find((j) => j.jogadorId === id)?.nome ?? `jogador ${id}`

  const escolhidos = titulares(r)
  if (new Set(escolhidos).size !== escolhidos.length) {
    violacoes.push({ codigo: 'RG-FOR-005', mensagem: 'O mesmo jogador não pode ocupar duas posições. Cada posição precisa de um jogador diferente.' })
  }
  for (const id of Array.from(new Set(escolhidos))) {
    const v = validarEntradaEmQuadra({ relacao: ids, jogador: id })
    if (!v.ok) violacoes.push({ codigo: v.codigo, mensagem: `${nomeDe(id)} não consta no elenco desta partida.` })
  }

  if (r.liberoId !== null) {
    const v = validarRegistroDeLiberos([r.liberoId], [...ids])
    if (!v.ok) violacoes.push({ codigo: v.codigo, mensagem: `${nomeDe(r.liberoId)} não consta no elenco desta partida.` })
    if (escolhidos.includes(r.liberoId)) {
      violacoes.push({ codigo: 'RG-LIB-003', mensagem: `${nomeDe(r.liberoId)} está entre os 6 titulares. O líbero não ocupa posição na formação inicial: escolha outro líbero ou outro titular.` })
    }
  }
  if (r.capitaoId !== null) {
    if (!ids.includes(r.capitaoId)) {
      violacoes.push({ codigo: 'RG-ELE-005', mensagem: 'O capitão escolhido não consta no elenco desta partida.' })
    } else if (r.capitaoId === r.liberoId) {
      violacoes.push({ codigo: 'RG-ELE-005', mensagem: 'O líbero não pode ser o capitão da equipe. Escolha outro jogador como capitão.' })
    }
  }
  return { violacoes, faltando, pronta: faltando.length === 0 && violacoes.length === 0 }
}

/** Mensagem curta do que ainda falta, para o botão "Enviar" desabilitado. */
export function motivoNaoPodeEnviar(v: ResultadoValidacao): string | null {
  if (v.pronta) return null
  if (v.violacoes.length > 0) return v.violacoes[0]!.mensagem
  const numerais = v.faltando.map((p) => NUMERAL_POSICAO[p]).join(', ')
  return v.faltando.length === 1 ? `Falta escolher o jogador da posição ${numerais}.` : `Faltam as posições ${numerais}.`
}

export function igual(a: RascunhoPapeleta, b: RascunhoPapeleta): boolean {
  return a.liberoId === b.liberoId && a.capitaoId === b.capitaoId && POSICOES.every((p) => a.slots[p] === b.slots[p])
}
