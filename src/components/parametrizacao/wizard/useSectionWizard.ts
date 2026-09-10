'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SetupSection, ChampionshipSetupStatus } from '@/types/championship-setup'

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface ValidationIssueLike {
  section: string
  code: string
  message: string
  severity: 'error' | 'warning'
}

interface UseSectionWizardResult<T extends object> {
  data: T | null
  loading: boolean
  loadError: string | null
  autosaveStatus: AutosaveStatus
  autosaveError: string | null
  setupStatus: ChampionshipSetupStatus | null
  issues: ValidationIssueLike[]
  /** Enfileira uma alteração para autosave (debounce 700ms, maxWait 5s). */
  update: (patch: Partial<T>) => void
  /** Aplica e envia imediatamente — para chips/toggles/select/número. */
  updateNow: (patch: Partial<T>) => void
  /** Força o envio do que estiver pendente agora (blur, troca de subetapa). */
  flush: () => void
  /** "Salvar e concluir": envia o pendente + intent=complete. */
  complete: () => Promise<{ ok: boolean; issues: ValidationIssueLike[] }>
}

const DEBOUNCE_MS = 700
const MAX_WAIT_MS = 5000

export function useSectionWizard<T extends object>(
  section: SetupSection,
  endpoint: string,
): UseSectionWizardResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('idle')
  const [autosaveError, setAutosaveError] = useState<string | null>(null)
  const [setupStatus, setSetupStatus] = useState<ChampionshipSetupStatus | null>(null)
  const [issues, setIssues] = useState<ValidationIssueLike[]>([])

  // Fila de 1 request em voo por seção, com coalescência do pending — o
  // PATCH tem efeito colateral de status no servidor, então ordem de
  // CHEGADA importa; não basta debounce isolado.
  const pendingRef = useRef<Partial<T> | null>(null)
  const inFlightRef = useRef<Promise<unknown> | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const maxWaitRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    fetch(endpoint, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Erro ao carregar esta seção.')
        return payload.data as T
      })
      .then((loaded) => {
        if (cancelled) return
        // O GET não devolve setupStatus (só os PATCHs, via finalizeSectionPatch)
        // — fica null até o primeiro autosave/conclusão desta sessão.
        setData(loaded)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Erro ao carregar esta seção.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint])

  const drain = useCallback(() => {
    if (inFlightRef.current || !pendingRef.current) return

    const body = pendingRef.current
    pendingRef.current = null
    setAutosaveStatus('saving')
    setAutosaveError(null)

    const request = fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Erro ao salvar.')
        const returned = payload.data as T & { setupStatus?: ChampionshipSetupStatus }

        // Aplica só o que foi enviado (mais o que o servidor derivou, ex.:
        // formularioInscricaoConfig mesclado) — nunca sobrescreve campos que
        // o organizador já alterou de novo enquanto esta requisição voava.
        setData((current) => {
          if (!current) return current
          const next = { ...current }
          for (const key of Object.keys(body)) {
            if (key in returned) next[key as keyof T] = returned[key as keyof T]
          }
          return next
        })
        if (returned.setupStatus) setSetupStatus(returned.setupStatus)
        setAutosaveStatus('saved')
      })
      .catch((err) => {
        setAutosaveStatus('error')
        setAutosaveError(err instanceof Error ? err.message : 'Erro ao salvar.')
        // Não reenfileira sozinho — evitaria tempestade de requisições
        // quando o erro é de validação (ex.: 422 do QR).
      })
      .finally(() => {
        inFlightRef.current = null
        if (pendingRef.current) drain()
      })

    inFlightRef.current = request
  }, [endpoint])

  const flush = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    if (maxWaitRef.current) {
      clearTimeout(maxWaitRef.current)
      maxWaitRef.current = null
    }
    drain()
  }, [drain])

  const enqueue = useCallback(
    (patch: Partial<T>, immediate: boolean) => {
      pendingRef.current = { ...(pendingRef.current ?? {}), ...patch }
      setData((current) => (current ? { ...current, ...patch } : current))

      if (immediate) {
        flush()
        return
      }

      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(flush, DEBOUNCE_MS)

      if (!maxWaitRef.current) {
        maxWaitRef.current = setTimeout(flush, MAX_WAIT_MS)
      }
    },
    [flush],
  )

  const update = useCallback((patch: Partial<T>) => enqueue(patch, false), [enqueue])
  const updateNow = useCallback((patch: Partial<T>) => enqueue(patch, true), [enqueue])

  const complete = useCallback(async (): Promise<{ ok: boolean; issues: ValidationIssueLike[] }> => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (maxWaitRef.current) clearTimeout(maxWaitRef.current)
    debounceRef.current = null
    maxWaitRef.current = null

    // Espera o request em voo (se houver) resolver antes de mandar o
    // "concluir", para não competir por ordem de chegada no servidor.
    if (inFlightRef.current) await inFlightRef.current.catch(() => {})

    const body = pendingRef.current ?? {}
    pendingRef.current = null
    setAutosaveStatus('saving')
    setAutosaveError(null)

    try {
      const response = await fetch(`${endpoint}?intent=complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await response.json()

      if (!response.ok) {
        setAutosaveStatus('error')
        setAutosaveError(payload.error || 'Não foi possível concluir esta seção.')
        return { ok: false, issues: (payload.details as ValidationIssueLike[]) ?? [] }
      }

      const returned = payload.data as T & { setupStatus?: ChampionshipSetupStatus; issues?: ValidationIssueLike[] }
      setData((current) => (current ? { ...current, ...returned } : returned))
      if (returned.setupStatus) setSetupStatus(returned.setupStatus)
      const returnedIssues = returned.issues ?? []
      setIssues(returnedIssues)
      setAutosaveStatus('saved')
      return { ok: true, issues: returnedIssues }
    } catch (err) {
      setAutosaveStatus('error')
      setAutosaveError(err instanceof Error ? err.message : 'Não foi possível concluir esta seção.')
      return { ok: false, issues: [] }
    }
  }, [endpoint])

  // Flush ao desmontar (troca de subetapa/seção) para não perder o que
  // ainda estava no debounce.
  useEffect(() => () => flush(), [flush])

  return { data, loading, loadError, autosaveStatus, autosaveError, setupStatus, issues, update, updateNow, flush, complete }
}
