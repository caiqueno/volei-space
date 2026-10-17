/**
 * Fila local de ações pendentes (falta de rede) e lista das ações lançadas neste aparelho (para "Desfazer última").
 * Módulo PURO: o armazenamento é injetado (localStorage no navegador) e todo acesso é protegido por try/catch.
 */
import type { PayloadAcao } from './tipos'

export interface ItemFila {
  payload: PayloadAcao
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
      saida.push({
        payload: it.payload,
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

/** O que fazer com o item após a resposta. 2xx e 409 (já gravada) saem da fila; erro de validação descarta; o resto tenta de novo. */
export function destinoDaResposta(status: number | null): 'enviada' | 'descartar' | 'tentar-de-novo' {
  if (status === null) return 'tentar-de-novo'
  if (status >= 200 && status < 300) return 'enviada'
  if (status === 409) return 'enviada'
  if (status === 408 || status === 425 || status === 429 || status >= 500) return 'tentar-de-novo'
  return 'descartar'
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
