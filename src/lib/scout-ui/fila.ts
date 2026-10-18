/**
 * Fila local de ações pendentes (falta de rede) e lista das ações lançadas neste aparelho (para "Desfazer última").
 * Módulo PURO: o armazenamento é injetado (localStorage no navegador) e todo acesso é protegido por try/catch.
 */
import type { AcaoServidor, CamposCorrecao, PayloadAcao } from './tipos'

/** Correção pendente de uma ação já gravada: vai por PATCH /acoes/[id] (idempotente: repetir dá o mesmo resultado). */
export interface CorrecaoPendente {
  acaoId: number | string
  campos: CamposCorrecao
}

export interface ItemFila {
  /** Ação nova (POST). Em correção, é o retrato da ação original (só identifica o item na fila). */
  payload: PayloadAcao
  /** Presente quando o item é uma correção (PATCH) em vez de uma ação nova. */
  correcao?: CorrecaoPendente
  tentativas: number
  /** Epoch ms da próxima tentativa. */
  proximaEm: number
}

export interface Armazenamento {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
}

export const LIMITE_FILA = 500
export const RECUO_BASE_MS = 2000
export const RECUO_MAX_MS = 60000

export const chaveFila = (token: string) => `vs-scout-fila:${token}`
export const chaveMinhas = (token: string) => `vs-scout-minhas:${token}`

/** 2 s, 4 s, 8 s... até 60 s. */
export function recuoFila(tentativas: number): number {
  const n = Math.max(0, Math.floor(tentativas))
  return Math.min(RECUO_MAX_MS, RECUO_BASE_MS * 2 ** Math.min(n, 10))
}

function ehPayload(p: unknown): p is PayloadAcao {
  const o = p as Partial<PayloadAcao> | null
  return (
    !!o &&
    typeof o === 'object' &&
    typeof o.clientEventId === 'string' &&
    o.clientEventId.length > 0 &&
    typeof o.setNumero === 'number' &&
    typeof o.equipeId === 'number' &&
    typeof o.fundamento === 'string' &&
    typeof o.resultado === 'string'
  )
}

function lerCorrecao(c: unknown): CorrecaoPendente | null {
  const o = c as Partial<CorrecaoPendente> | null | undefined
  if (!o || typeof o !== 'object') return null
  if (typeof o.acaoId !== 'number' && typeof o.acaoId !== 'string') return null
  if (!o.campos || typeof o.campos !== 'object') return null
  return { acaoId: o.acaoId, campos: o.campos }
}

export function interpretarFila(bruto: string | null): ItemFila[] {
  if (!bruto) return []
  try {
    const v: unknown = JSON.parse(bruto)
    if (!Array.isArray(v)) return []
    const vistos = new Set<string>()
    const saida: ItemFila[] = []
    for (const it of v as Partial<ItemFila>[]) {
      if (!it || !ehPayload(it.payload) || vistos.has(it.payload.clientEventId)) continue
      vistos.add(it.payload.clientEventId)
      const correcao = lerCorrecao(it.correcao)
      saida.push({
        payload: it.payload,
        ...(correcao ? { correcao } : {}),
        tentativas: Number.isFinite(it.tentativas) ? Math.max(0, Number(it.tentativas)) : 0,
        proximaEm: Number.isFinite(it.proximaEm) ? Number(it.proximaEm) : 0,
      })
    }
    return saida
  } catch {
    return []
  }
}

export function lerFila(arm: Armazenamento | null, token: string): ItemFila[] {
  try {
    return interpretarFila(arm ? arm.getItem(chaveFila(token)) : null)
  } catch {
    return []
  }
}

export function gravarFila(arm: Armazenamento | null, token: string, fila: readonly ItemFila[]): boolean {
  try {
    if (!arm) return false
    arm.setItem(chaveFila(token), JSON.stringify(fila))
    return true
  } catch {
    return false
  }
}

/** Entra no fim; mesmo clientEventId não duplica; ao passar do limite descarta a mais antiga. */
export function enfileirar(fila: readonly ItemFila[], payload: PayloadAcao, agora: number): ItemFila[] {
  if (fila.some((i) => i.payload.clientEventId === payload.clientEventId)) return [...fila]
  const nova = [...fila, { payload, tentativas: 0, proximaEm: agora }]
  return nova.length > LIMITE_FILA ? nova.slice(nova.length - LIMITE_FILA) : nova
}

export const idCorrecao = (acaoId: number | string) => `corrigir:${acaoId}`

/**
 * Enfileira a correção de uma ação já gravada. O id do item é determinístico por ação: corrigir a mesma ação duas vezes
 * antes de enviar junta os campos (a última escolha vence) em vez de duplicar. Null se a ação não tem set/equipe.
 */
export function enfileirarCorrecao(fila: readonly ItemFila[], acao: AcaoServidor, campos: CamposCorrecao, agora: number): ItemFila[] | null {
  const setNumero = acao.setNumero ?? acao.set
  if (typeof setNumero !== 'number' || typeof acao.equipeId !== 'number' || Object.keys(campos).length === 0) return null
  const id = idCorrecao(acao.id)
  const existente = fila.find((i) => i.payload.clientEventId === id)
  if (existente?.correcao) {
    const juntos = { ...existente.correcao.campos, ...campos }
    return fila.map((i) => (i === existente ? { ...i, correcao: { acaoId: acao.id, campos: juntos }, tentativas: 0, proximaEm: agora } : i))
  }
  const item: ItemFila = {
    payload: { clientEventId: id, setNumero, equipeId: acao.equipeId, fundamento: acao.fundamento, resultado: acao.resultado },
    correcao: { acaoId: acao.id, campos },
    tentativas: 0,
    proximaEm: agora,
  }
  const nova = [...fila, item]
  return nova.length > LIMITE_FILA ? nova.slice(nova.length - LIMITE_FILA) : nova
}

export interface RequisicaoItem {
  metodo: 'POST' | 'PATCH'
  /** Sufixo depois de /api/scout/[token]. */
  resto: string
  corpo: unknown
}

/** Como enviar o item: ação nova por POST /acoes; correção por PATCH /acoes/[id] só com os campos alterados. */
export function requisicaoDoItem(item: ItemFila): RequisicaoItem {
  if (item.correcao) {
    return { metodo: 'PATCH', resto: `/acoes/${encodeURIComponent(String(item.correcao.acaoId))}`, corpo: item.correcao.campos }
  }
  return { metodo: 'POST', resto: '/acoes', corpo: item.payload }
}

/**
 * Destino do item após a resposta. Igual a destinoDaResposta, exceto que numa correção 404/410 significa "ação apagada":
 * descarta só esse item em vez de pausar a fila toda.
 */
export function destinoDoItem(item: ItemFila, status: number | null): DestinoResposta {
  if (item.correcao && (status === 404 || status === 410)) return 'descartar'
  return destinoDaResposta(status)
}

export function remover(fila: readonly ItemFila[], clientEventId: string): ItemFila[] {
  return fila.filter((i) => i.payload.clientEventId !== clientEventId)
}

/** Item da frente, se já venceu o recuo (a ordem de lançamento é preservada: só o da frente é tentado). */
export function proximoParaEnviar(fila: readonly ItemFila[], agora: number): ItemFila | null {
  const f = fila[0]
  return f && f.proximaEm <= agora ? f : null
}

/** Falha de rede ou 5xx: conta a tentativa e agenda com recuo. */
export function registrarFalha(fila: readonly ItemFila[], clientEventId: string, agora: number): ItemFila[] {
  return fila.map((i) =>
    i.payload.clientEventId === clientEventId ? { ...i, tentativas: i.tentativas + 1, proximaEm: agora + recuoFila(i.tentativas) } : i,
  )
}

export type DestinoResposta = 'enviada' | 'descartar' | 'tentar-de-novo' | 'pausar'

/**
 * O que fazer com o item após a resposta. 2xx e 409 (já gravada) saem da fila; só 400/422 (validação) descartam;
 * 401/403 (sessão) e 404/410 (link) PAUSAM a fila sem perder nada; o resto tenta de novo com recuo.
 */
export function destinoDaResposta(status: number | null): DestinoResposta {
  if (status === null) return 'tentar-de-novo'
  if (status >= 200 && status < 300) return 'enviada'
  if (status === 409) return 'enviada'
  if (status === 401 || status === 403 || status === 404 || status === 410) return 'pausar'
  if (status === 408 || status === 425 || status === 429 || status >= 500) return 'tentar-de-novo'
  return 'descartar'
}

/** Mensagem da fila pausada: as ações continuam guardadas neste aparelho. */
export function textoPausaFila(status: number | null): string {
  if (status === 404 || status === 410) return 'Link do scout indisponível: confira o link com o organizador. Suas ações continuam salvas neste aparelho.'
  return 'Sessão expirada: entre de novo, suas ações continuam salvas.'
}

export function textoPendentes(n: number): string {
  if (n <= 0) return 'Tudo enviado'
  return n === 1 ? '1 pendente' : `${n} pendentes`
}

/* ---- Ações lançadas por este aparelho (para desfazer) ---- */

export interface MinhaAcao {
  id: number | string
  clientEventId: string
}

export function lerMinhas(arm: Armazenamento | null, token: string): MinhaAcao[] {
  try {
    const v: unknown = JSON.parse((arm && arm.getItem(chaveMinhas(token))) || '[]')
    if (!Array.isArray(v)) return []
    return v.filter(
      (m): m is MinhaAcao => !!m && (typeof m.id === 'number' || typeof m.id === 'string') && typeof m.clientEventId === 'string',
    )
  } catch {
    return []
  }
}

export function gravarMinhas(arm: Armazenamento | null, token: string, minhas: readonly MinhaAcao[]): boolean {
  try {
    if (!arm) return false
    arm.setItem(chaveMinhas(token), JSON.stringify(minhas.slice(-100)))
    return true
  } catch {
    return false
  }
}

export function registrarMinha(minhas: readonly MinhaAcao[], m: MinhaAcao): MinhaAcao[] {
  return [...minhas.filter((x) => x.clientEventId !== m.clientEventId), m].slice(-100)
}

export type PlanoDesfazer =
  | { tipo: 'cancelar-pendente'; clientEventId: string }
  | { tipo: 'apagar-no-servidor'; id: number | string; clientEventId: string }
  | { tipo: 'nada' }

/** "Desfazer última" do aparelho: se a última ainda está na fila, só tira da fila; senão apaga a última gravada no servidor. */
export function planoDesfazer(fila: readonly ItemFila[], minhas: readonly MinhaAcao[]): PlanoDesfazer {
  const ultimaFila = fila[fila.length - 1]
  if (ultimaFila) return { tipo: 'cancelar-pendente', clientEventId: ultimaFila.payload.clientEventId }
  const m = minhas[minhas.length - 1]
  return m ? { tipo: 'apagar-no-servidor', id: m.id, clientEventId: m.clientEventId } : { tipo: 'nada' }
}
