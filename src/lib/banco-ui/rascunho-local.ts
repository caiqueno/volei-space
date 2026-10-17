/** Rascunho da papeleta no aparelho (localStorage, sempre em try/catch: modo privado ou cota cheia não quebram a tela). */
import { POSICOES } from './formacao'
import type { RascunhoPapeleta } from './tipos'

export function chaveRascunho(token: string, set: number): string {
  return `vs:banco:papeleta:${token}:${set}`
}

function armazenamento(): Storage | undefined {
  return typeof window !== 'undefined' ? window.localStorage : undefined
}

export function lerRascunho(token: string, set: number, storage?: Pick<Storage, 'getItem'>): RascunhoPapeleta | null {
  try {
    const s = storage ?? armazenamento()
    const bruto = s?.getItem(chaveRascunho(token, set))
    return bruto ? interpretarRascunho(bruto) : null
  } catch {
    return null
  }
}

export function gravarRascunho(token: string, set: number, r: RascunhoPapeleta, storage?: Pick<Storage, 'setItem'>): boolean {
  try {
    const s = storage ?? armazenamento()
    if (!s) return false
    s.setItem(chaveRascunho(token, set), JSON.stringify(r))
    return true
  } catch {
    return false
  }
}

export function apagarRascunho(token: string, set: number, storage?: Pick<Storage, 'removeItem'>): void {
  try {
    const s = storage ?? armazenamento()
    s?.removeItem(chaveRascunho(token, set))
  } catch {
    /* sem armazenamento: ignora */
  }
}

/** Lê JSON salvo e descarta o que estiver fora do formato (dado antigo ou adulterado). */
export function interpretarRascunho(bruto: string): RascunhoPapeleta | null {
  try {
    const j = JSON.parse(bruto) as Record<string, unknown>
    const slotsBrutos = (j.slots ?? {}) as Record<string, unknown>
    const id = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) ? v : null)
    const slots: Record<number, number | null> = {}
    for (const p of POSICOES) slots[p] = id(slotsBrutos[String(p)])
    return { slots, liberoId: id(j.liberoId), capitaoId: id(j.capitaoId) }
  } catch {
    return null
  }
}
