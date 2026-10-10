'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useCategoriaAtivaNoPainel } from '../PainelParametrizacaoContext'
import { ConsultaCancelada, consultar, invalidarConsultas, lerJson } from '@/lib/api-cliente'
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
  fieldMessages: Record<string, string>
  clearFieldMessage: (key: string) => void
  setupStatus: ChampionshipSetupStatus | null
  issues: ValidationIssueLike[]
  /** Enfileira uma alteração para autosave (debounce 700ms, maxWait 5s). */
  update: (patch: Partial<T>) => void
  /** Aplica e envia imediatamente — para chips/toggles/select/número. */
  updateNow: (patch: Partial<T>) => void
  /** Força o envio do que estiver pendente agora (blur, troca de subetapa). */
  flush: () => void
  /** Grava a etapa atual e só devolve ok quando o servidor aceita. */
  persist: () => Promise<{ ok: boolean; message: string | null }>
  /** "Salvar e concluir": envia o que está na tela + intent=complete. */
  complete: () => Promise<{ ok: boolean; issues: ValidationIssueLike[]; fields: string[] }>
}

const DEBOUNCE_MS = 700
const MAX_WAIT_MS = 5000
const flushPendentes = new Set<() => Promise<boolean>>()

export async function flushWizardChanges() {
  const resultados = await Promise.all(Array.from(flushPendentes, (flush) => flush()))
  return resultados.every(Boolean)
}

export function useSectionWizard<T extends object>(
  section: SetupSection,
  endpoint: string,
): UseSectionWizardResult<T> {
  const searchParams = useSearchParams()
  const categoriaNoPainel = useCategoriaAtivaNoPainel()
  const categoryId = section === 'informacoes'
    ? null
    : categoriaNoPainel !== undefined
      ? categoriaNoPainel
      : searchParams.get('categoriaCampeonatoId')
  const scopedEndpoint = categoryId
    ? `${endpoint}${endpoint.includes('?') ? '&' : '?'}categoriaCampeonatoId=${encodeURIComponent(categoryId)}`
    : endpoint
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('idle')
  const [autosaveError, setAutosaveError] = useState<string | null>(null)
  const [fieldMessages, setFieldMessages] = useState<Record<string, string>>({})
  const [setupStatus, setSetupStatus] = useState<ChampionshipSetupStatus | null>(null)
  const [issues, setIssues] = useState<ValidationIssueLike[]>([])

  // Fila de 1 request em voo por seção, com coalescência do pending — o
  // PATCH tem efeito colateral de status no servidor, então ordem de
  // CHEGADA importa; não basta debounce isolado.
  const pendingRef = useRef<Partial<T> | null>(null)
  const dataRef = useRef<T | null>(null)
  const inFlightRef = useRef<Promise<unknown> | null>(null)
  const salvoRef = useRef(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const maxWaitRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    const controlador = new AbortController()
    consultar<{ data: T }>(scopedEndpoint, { signal: controlador.signal })
      .then((payload) => payload.data)
      .then((loaded) => {
        if (cancelled) return
        // O GET não devolve setupStatus (só os PATCHs, via finalizeSectionPatch)
        // — fica null até o primeiro autosave/conclusão desta sessão.
        dataRef.current = loaded
        setData(loaded)
      })
      .catch((err) => {
        if (cancelled || err instanceof ConsultaCancelada) return
        setLoadError(err instanceof Error ? err.message : 'Erro ao carregar esta seção.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      controlador.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedEndpoint])

  const drain = useCallback(() => {
    if (inFlightRef.current || !pendingRef.current) return

    const body = pendingRef.current
    pendingRef.current = null
    setAutosaveStatus('saving')
    setAutosaveError(null)

    const request = fetch(scopedEndpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(async (response) => {
        const payload = await lerJson<{ error?: string; data?: T & { setupStatus?: ChampionshipSetupStatus }; details?: { fields?: unknown; messages?: unknown } }>(response)
        if (!response.ok) {
          rememberFieldFailure(payload, setFieldMessages, setAutosaveError)
          setAutosaveStatus('error')
          salvoRef.current = false
          return
        }
        salvoRef.current = true
        setFieldMessages({})
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
          dataRef.current = next
          return next
        })
        if (returned.setupStatus) setSetupStatus(returned.setupStatus)
        const base = scopedEndpoint.includes('/setup/') ? `${scopedEndpoint.split('/setup/')[0]}/setup` : scopedEndpoint
        invalidarConsultas(base)
        setAutosaveStatus('saved')
      })
      .catch((err) => {
        salvoRef.current = false
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
  }, [scopedEndpoint])

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

  useEffect(() => {
    const executar = async () => {
      const tinhaTrabalho = pendingRef.current != null || inFlightRef.current != null
      if (!tinhaTrabalho) return true
      salvoRef.current = true
      flush()
      const voo = inFlightRef.current
      if (voo) {
        try { await voo } catch { return false }
      }
      return salvoRef.current && pendingRef.current == null
    }
    flushPendentes.add(executar)
    return () => { flushPendentes.delete(executar) }
  }, [flush])

  const enqueue = useCallback(
    (patch: Partial<T>, immediate: boolean) => {
      pendingRef.current = { ...(pendingRef.current ?? {}), ...patch }
      setData((current) => {
        const next = current ? { ...current, ...patch } : current
        dataRef.current = next
        return next
      })

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

  const clearFieldMessage = useCallback((key: string) => {
    setFieldMessages((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }, [])

  const update = useCallback((patch: Partial<T>) => enqueue(patch, false), [enqueue])
  const updateNow = useCallback((patch: Partial<T>) => enqueue(patch, true), [enqueue])

  const persist = useCallback(async (): Promise<{ ok: boolean; message: string | null }> => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (maxWaitRef.current) clearTimeout(maxWaitRef.current)
    debounceRef.current = null
    maxWaitRef.current = null
    if (inFlightRef.current) await inFlightRef.current.catch(() => {})

    const body = sectionPayload(dataRef.current, pendingRef.current)
    pendingRef.current = null
    if (Object.keys(body).length === 0) {
      return { ok: salvoRef.current, message: salvoRef.current ? null : 'Não foi possível salvar. Os dados desta etapa continuam na tela.' }
    }

    setAutosaveStatus('saving')
    setAutosaveError(null)
    try {
      const response = await fetch(scopedEndpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await lerJson<{ error?: string; data?: T & { setupStatus?: ChampionshipSetupStatus }; details?: { fields?: unknown; messages?: unknown } }>(response)
      if (!response.ok) {
        const failure = rememberFieldFailure(payload, setFieldMessages, setAutosaveError)
        setAutosaveStatus('error')
        salvoRef.current = false
        return { ok: false, message: failure.issues[0]?.message ?? 'Não foi possível salvar. Os dados desta etapa continuam na tela.' }
      }

      salvoRef.current = true
      setFieldMessages({})
      const returned = payload.data as T & { setupStatus?: ChampionshipSetupStatus }
      setData((current) => {
        if (!current) return current
        const next = { ...current }
        for (const key of Object.keys(body)) {
          if (key in returned) next[key as keyof T] = returned[key as keyof T]
        }
        dataRef.current = next
        return next
      })
      if (returned.setupStatus) setSetupStatus(returned.setupStatus)
      const base = scopedEndpoint.includes('/setup/') ? `${scopedEndpoint.split('/setup/')[0]}/setup` : scopedEndpoint
      invalidarConsultas(base)
      setAutosaveStatus('saved')
      return { ok: true, message: null }
    } catch (err) {
      salvoRef.current = false
      setAutosaveStatus('error')
      const message = err instanceof Error ? err.message : 'Não foi possível salvar. Os dados desta etapa continuam na tela.'
      setAutosaveError(message)
      return { ok: false, message }
    }
  }, [scopedEndpoint])

  const complete = useCallback(async (): Promise<{ ok: boolean; issues: ValidationIssueLike[]; fields: string[] }> => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (maxWaitRef.current) clearTimeout(maxWaitRef.current)
    debounceRef.current = null
    maxWaitRef.current = null

    // Espera o request em voo (se houver) resolver antes de mandar o
    // "concluir", para não competir por ordem de chegada no servidor.
    if (inFlightRef.current) await inFlightRef.current.catch(() => {})

    const body = sectionPayload(dataRef.current, pendingRef.current)
    pendingRef.current = null
    setAutosaveStatus('saving')
    setAutosaveError(null)

    try {
      const response = await fetch(`${scopedEndpoint}${scopedEndpoint.includes('?') ? '&' : '?'}intent=complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await lerJson<{ error?: string; data?: T & { setupStatus?: ChampionshipSetupStatus; issues?: ValidationIssueLike[] }; details?: { fields?: unknown; messages?: unknown } }>(response)

      if (!response.ok) {
        const failure = rememberFieldFailure(payload, setFieldMessages, setAutosaveError)
        setAutosaveStatus('error')
        return { ok: false, issues: failure.issues, fields: failure.fields }
      }
      setFieldMessages({})

      const returned = payload.data as T & { setupStatus?: ChampionshipSetupStatus; issues?: ValidationIssueLike[] }
      setData((current) => {
        const next = current ? { ...current, ...returned } : returned
        dataRef.current = next
        return next
      })
      if (returned.setupStatus) setSetupStatus(returned.setupStatus)
      const returnedIssues = returned.issues ?? []
      setIssues(returnedIssues)
      setAutosaveStatus('saved')
      return { ok: true, issues: returnedIssues, fields: [] }
    } catch (err) {
      setAutosaveStatus('error')
      setAutosaveError(err instanceof Error ? err.message : 'Não foi possível concluir esta seção.')
      return { ok: false, issues: [], fields: [] }
    }
  }, [scopedEndpoint])

  // Flush ao desmontar (troca de subetapa/seção) para não perder o que
  // ainda estava no debounce.
  useEffect(() => () => flush(), [flush])

  return { data, loading, loadError, autosaveStatus, autosaveError, fieldMessages, clearFieldMessage, setupStatus, issues, update, updateNow, flush, persist, complete }
}

function rememberFieldFailure(
  payload: { error?: string; details?: { fields?: unknown; messages?: unknown } | unknown },
  setFieldMessages: (value: Record<string, string>) => void,
  setAutosaveError: (value: string) => void,
) {
  const details = payload.details && !Array.isArray(payload.details) ? payload.details as { fields?: unknown; messages?: unknown } : null
  const fields = Array.isArray(details?.fields) ? details.fields.filter((field): field is string => typeof field === 'string') : []
  const messages = Array.isArray(details?.messages) ? details.messages.filter((message): message is string => typeof message === 'string') : []
  const fallback = payload.error || 'Dados inválidos'
  const map: Record<string, string> = {}
  fields.forEach((field, index) => {
    map[field] = messages[index] || fallback
  })
  setFieldMessages(map)
  setAutosaveError(messages.length ? messages.join(' ') : fallback)
  const issues: ValidationIssueLike[] = (messages.length ? messages : [fallback]).map((message) => ({
    section: '',
    code: 'invalid',
    message,
    severity: 'error',
  }))
  return { fields, issues }
}

const CAMPOS_QUE_PODEM_VOLTAR_A_HERDAR = new Set(['setsPorPartidaFinal', 'setsPorPartidaSemifinal', 'setsPorPartidaTerceiroLugar'])

function sectionPayload<T extends object>(current: T | null, pending: Partial<T> | null) {
  const source = { ...(current ?? {}), ...(pending ?? {}) } as Record<string, unknown>
  const body: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(source)) {
    if (key === 'id' || key === 'organizadorId' || key === 'setupStatus' || key === 'issues' || key === 'locais' || key === 'formato') continue
    if (value == null || value === '') {
      if (CAMPOS_QUE_PODEM_VOLTAR_A_HERDAR.has(key) && pending && Object.prototype.hasOwnProperty.call(pending, key)) body[key] = null
      continue
    }
    body[key] = value
  }
  return body
}
