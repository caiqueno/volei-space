'use client'

import { useEffect, useRef, useState } from 'react'
import {
  bancoAppAtivo,
  divergenciasPapeleta,
  formacaoAplicavel,
  idsPorIndice,
  lerEnvelope,
  mensagemDivergencia,
  papeletaJaAceita,
  papeletasParaExibir,
  type ItemFormacao,
  type PapeletaBanco,
} from '@/lib/sumula-banco-ui'

const INTERVALO_MS = 3000

export interface EscalacaoDaTela {
  formacao: Array<ItemFormacao | null>
  liberoId: number | null
  confirmada: boolean
}

export interface PapeletasDoSetProps {
  token: string
  set: number
  equipes: Array<{ equipeId: number; nome: string }>
  /** Escalação atual da tela para a equipe (ids de atleta por posição), ou null se não houver. */
  escalacaoDaTela: (equipeId: number) => EscalacaoDaTela | null
  rotuloJogador: (equipeId: number, jogadorId: number) => string | null
  /** Aplica a formação (ids por índice da quadra) no fluxo de escalação existente; o apontador ainda confirma. */
  onAplicar: (equipeId: number, idsPorIndice: number[], liberoId: number | null) => void
  aviso?: (mensagem: string) => void
}

/** Papeletas enviadas pelo banco antes do set. Com a flag desligada não renderiza nada e não faz requisição. */
export function PapeletasDoSet(props: PapeletasDoSetProps) {
  const ativo = bancoAppAtivo(process.env.NEXT_PUBLIC_BANCO_APP_ATIVO)
  const { token, set } = props
  const [papeletas, setPapeletas] = useState<PapeletaBanco[]>([])
  const [aceitas, setAceitas] = useState<Set<number>>(new Set())
  const [enviando, setEnviando] = useState<number | null>(null)
  const desligadoRef = useRef(false)
  const avisoRef = useRef(props.aviso)
  avisoRef.current = props.aviso

  useEffect(() => {
    if (!ativo || !token) return
    let vivo = true
    let timer: ReturnType<typeof setTimeout> | undefined
    desligadoRef.current = false

    async function buscar() {
      if (!vivo || desligadoRef.current) return
      if (typeof document === 'undefined' || !document.hidden) {
        try {
          const resposta = await fetch(`/api/sumula/${encodeURIComponent(token)}/papeleta/${set}`, { cache: 'no-store' })
          const lido = await lerEnvelope<{ papeletas: PapeletaBanco[] }>(resposta)
          if (!vivo) return
          if (lido.tipo === 'desligado') {
            desligadoRef.current = true
            setPapeletas([])
            return
          }
          if (lido.tipo === 'ok') setPapeletas(Array.isArray(lido.data?.papeletas) ? lido.data.papeletas : [])
        } catch {
          // Sem conexão: tenta de novo no próximo ciclo; a escalação manual continua disponível.
        }
      }
      if (vivo) timer = setTimeout(buscar, INTERVALO_MS)
    }

    setAceitas(new Set())
    void buscar()
    return () => {
      vivo = false
      if (timer) clearTimeout(timer)
    }
  }, [ativo, token, set])

  if (!ativo) return null
  const enviadas = papeletasParaExibir(papeletas)
  if (enviadas.length === 0) return null

  async function aceitar(papeleta: PapeletaBanco) {
    if (!formacaoAplicavel(papeleta.formacao)) {
      avisoRef.current?.('A papeleta do banco está incompleta. Monte a escalação manualmente.')
      return
    }
    setEnviando(papeleta.equipeId)
    props.onAplicar(papeleta.equipeId, idsPorIndice(papeleta.formacao), papeleta.liberoId)
    try {
      const resposta = await fetch(
        `/api/sumula/${encodeURIComponent(token)}/papeleta/${set}/${papeleta.equipeId}/aceitar`,
        { method: 'POST' },
      )
      const lido = await lerEnvelope<unknown>(resposta)
      if (lido.tipo === 'ok') setAceitas((atual) => new Set(atual).add(papeleta.equipeId))
      else avisoRef.current?.(`A formação foi aplicada na tela, mas o banco não recebeu o aceite${lido.tipo === 'erro' ? ` (${lido.mensagem})` : ''}. Confirme a escalação e tente aceitar de novo.`)
    } catch {
      avisoRef.current?.('Sem conexão para avisar o banco. A formação já está na tela; confirme a escalação.')
    } finally {
      setEnviando(null)
    }
  }

  return (
    <section aria-label={`Papeletas do banco para o set ${set}`} className="rounded-lg border-2 border-blue-700 bg-white p-3 text-slate-900">
      <h3 className="text-sm font-bold text-blue-900">Papeletas enviadas pelo banco (set {set})</h3>
      <ul className="mt-2 space-y-3">
        {enviadas.map((papeleta) => {
          const nome = props.equipes.find((e) => e.equipeId === papeleta.equipeId)?.nome ?? 'Equipe'
          const rotulo = (id: number) => props.rotuloJogador(papeleta.equipeId, id)
          const tela = props.escalacaoDaTela(papeleta.equipeId)
          const divergencias = tela?.confirmada ? divergenciasPapeleta(papeleta, tela) : []
          const aceita = aceitas.has(papeleta.equipeId) || papeletaJaAceita(papeleta)
          return (
            <li key={papeleta.equipeId} className="rounded-md border border-slate-300 p-2">
              <p className="font-semibold">
                {nome}
                {aceita ? <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-900">Aceita</span> : null}
              </p>
              <ol className="mt-1 grid grid-cols-3 gap-1 text-sm" aria-label={`Formação de ${nome}`}>
                {[...papeleta.formacao].sort((a, b) => a.posicao - b.posicao).map((item) => (
                  <li key={item.posicao} className="rounded bg-slate-100 px-2 py-1">
                    <span className="text-xs text-slate-700">Pos. {item.posicao}: </span>
                    <span className="font-bold">{rotulo(item.jogadorId) ?? `atleta ${item.jogadorId}`}</span>
                  </li>
                ))}
              </ol>
              {papeleta.liberoId != null ? <p className="mt-1 text-sm">Líbero: <strong>{rotulo(papeleta.liberoId) ?? `atleta ${papeleta.liberoId}`}</strong></p> : null}
              {divergencias.length > 0 ? (
                <div role="alert" className="mt-2 rounded border-2 border-amber-600 bg-amber-50 p-2 text-sm text-amber-950">
                  <p className="font-bold">Diverge da escalação confirmada na tela</p>
                  <ul className="list-disc pl-5">
                    {divergencias.map((d, i) => <li key={i}>{mensagemDivergencia(d, rotulo)}</li>)}
                  </ul>
                </div>
              ) : tela?.confirmada ? (
                <p className="mt-2 text-sm text-green-900">Igual à escalação confirmada.</p>
              ) : null}
              <button
                type="button"
                disabled={aceita || enviando === papeleta.equipeId}
                onClick={() => void aceitar(papeleta)}
                className="mt-2 min-h-[48px] w-full rounded-md bg-blue-700 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {aceita ? 'Papeleta aceita' : enviando === papeleta.equipeId ? 'Enviando...' : 'Aceitar papeleta'}
              </button>
              {!aceita ? <p className="mt-1 text-xs text-slate-700">Aplica a formação na escalação; confira e confirme em seguida.</p> : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
