// Rascunho do assistente de inscrição, salvo sozinho no aparelho (localStorage).
import type { Atleta, MembroComissao } from './tipos'
import type { Escolha } from './selecao'

export type RascunhoAssistente = {
  versao: 1
  passo: 1 | 2 | 3 | 4
  escolhas: Escolha[]
  comissao: string[]
  aceite: boolean
  /** Token do convite do organizador, guardado para sobreviver a recarregar a página ou sair e voltar. */
  convite?: string
}

export function rascunhoVazio(): RascunhoAssistente {
  return { versao: 1, passo: 1, escolhas: [], comissao: [], aceite: false }
}

export function chaveRascunho(equipeId: string, categoriaId: string) {
  return `vs.meu-time.inscricao.${equipeId}.${categoriaId}`
}

export function serializarRascunho(rascunho: RascunhoAssistente) {
  return JSON.stringify(rascunho)
}

function escolhaValida(valor: unknown): valor is Escolha {
  if (!valor || typeof valor !== 'object') return false
  const e = valor as Record<string, unknown>
  return typeof e.atletaId === 'string' && typeof e.numero === 'string' && typeof e.capitao === 'boolean' && typeof e.libero === 'boolean'
}

/** Lê o texto salvo; qualquer coisa fora do formato vira null (o assistente começa limpo). */
export function lerRascunho(texto: string | null | undefined): RascunhoAssistente | null {
  if (!texto) return null
  try {
    const bruto = JSON.parse(texto) as Record<string, unknown>
    if (!bruto || bruto.versao !== 1) return null
    const passo = bruto.passo
    if (passo !== 1 && passo !== 2 && passo !== 3 && passo !== 4) return null
    if (!Array.isArray(bruto.escolhas) || !bruto.escolhas.every(escolhaValida)) return null
    if (!Array.isArray(bruto.comissao) || !bruto.comissao.every((id) => typeof id === 'string')) return null
    const convite = typeof bruto.convite === 'string' && bruto.convite.trim() !== '' && bruto.convite.length <= 200 ? bruto.convite.trim() : undefined
    return { versao: 1, passo, escolhas: bruto.escolhas, comissao: bruto.comissao as string[], aceite: bruto.aceite === true, ...(convite ? { convite } : {}) }
  } catch {
    return null
  }
}

/** Descarta o que não existe mais no time (atleta removido, membro da comissão removido). */
export function reconciliarRascunho(rascunho: RascunhoAssistente, atletas: Atleta[], comissao: MembroComissao[]): RascunhoAssistente {
  const atletaIds = new Set(atletas.map((a) => a.id))
  const membroIds = new Set(comissao.map((m) => m.id))
  return {
    ...rascunho,
    escolhas: rascunho.escolhas.filter((e) => atletaIds.has(e.atletaId)),
    comissao: rascunho.comissao.filter((id) => membroIds.has(id)),
  }
}

type Armazenamento = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function armazenamento(): Armazenamento | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

export function carregarRascunho(chave: string, loja: Armazenamento | null = armazenamento()): RascunhoAssistente | null {
  try {
    return loja ? lerRascunho(loja.getItem(chave)) : null
  } catch {
    return null
  }
}

/** Devolve false quando não deu para guardar (modo privado, cota cheia); a tela avisa sem travar. */
export function guardarRascunho(chave: string, rascunho: RascunhoAssistente, loja: Armazenamento | null = armazenamento()): boolean {
  try {
    if (!loja) return false
    loja.setItem(chave, serializarRascunho(rascunho))
    return true
  } catch {
    return false
  }
}

export function apagarRascunho(chave: string, loja: Armazenamento | null = armazenamento()) {
  try {
    loja?.removeItem(chave)
  } catch {
    // sem armazenamento: nada a apagar
  }
}
