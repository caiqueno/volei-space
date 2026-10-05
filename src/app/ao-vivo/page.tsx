'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Radio } from 'lucide-react'
import { Suspense } from 'react'

type PartidaAoVivo = {
  id: number
  status: string
  setsPorA: number | null
  setsPorB: number | null
  pontosPorA?: number | null
  pontosPorB?: number | null
  equipeA: { nome: string } | null
  equipeB: { nome: string } | null
  sets: Array<{ numero: number; pontosA: number; pontosB: number }>
  liga?: { nome?: string | null } | null
}

export default function AoVivoPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-5xl px-4 py-10 text-white">Carregando ao vivo…</main>}>
      <AoVivoPainel />
    </Suspense>
  )
}

function AoVivoPainel() {
  const params = useSearchParams()
  const ligaId = params.get('ligaId')
  const [partidas, setPartidas] = useState<PartidaAoVivo[]>([])
  const [temMais, setTemMais] = useState(false)
  const [erro, setErro] = useState('')
  const [carregandoMais, setCarregandoMais] = useState(false)
  const quantidade = useRef(12)

  useEffect(() => {
    let ativo = true
    const filtro = ligaId ? `&ligaId=${encodeURIComponent(ligaId)}` : ''
    async function carregar() {
      try {
        const resposta = await fetch(`/api/ao-vivo?limite=${quantidade.current}&offset=0${filtro}`, { cache: 'no-store' })
        const json = await resposta.json()
        if (!resposta.ok) throw new Error(json.error || 'Não foi possível carregar o ao vivo.')
        if (!ativo) return
        const lista = (json.data?.partidas ?? []) as PartidaAoVivo[]
        quantidade.current = Math.max(12, lista.length)
        setPartidas(lista)
        setTemMais(Boolean(json.data?.temMais))
        setErro('')
      } catch (causa) {
        if (ativo) setErro(causa instanceof Error ? causa.message : 'Não foi possível carregar o ao vivo.')
      }
    }
    quantidade.current = 12
    void carregar()
    const timer = window.setInterval(carregar, 5000)
    return () => {
      ativo = false
      window.clearInterval(timer)
    }
  }, [ligaId])

  async function verMais() {
    setCarregandoMais(true)
    try {
      const filtro = ligaId ? `&ligaId=${encodeURIComponent(ligaId)}` : ''
      const resposta = await fetch(`/api/ao-vivo?limite=12&offset=${partidas.length}${filtro}`, { cache: 'no-store' })
      const json = await resposta.json()
      if (!resposta.ok) throw new Error(json.error || 'Não foi possível carregar o ao vivo.')
      const novas = (json.data?.partidas ?? []) as PartidaAoVivo[]
      setPartidas((atual) => {
        const ids = new Set(atual.map((partida) => partida.id))
        const lista = [...atual, ...novas.filter((partida) => !ids.has(partida.id))]
        quantidade.current = Math.max(12, lista.length)
        return lista
      })
      setTemMais(Boolean(json.data?.temMais))
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível carregar o ao vivo.')
    } finally {
      setCarregandoMais(false)
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 text-white">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-red-300">Volei.space</p>
      <h1 className="mt-2 flex items-center gap-2 text-4xl font-black"><Radio size={28} /> Ao vivo</h1>
      <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">Somente partidas em andamento. O placar acompanha a súmula.</p>
      {erro && <p className="mt-6 text-sm font-bold text-red-200">{erro}</p>}
      {!erro && partidas.length === 0 && <p className="mt-8 text-sm font-semibold text-slate-300">Nenhuma partida ao vivo neste momento.</p>}
      <div className="mt-8 grid gap-4">
        {partidas.map((partida) => {
          const setAtual = [...(partida.sets ?? [])].sort((a, b) => a.numero - b.numero).at(-1)
          return (
            <Link key={partida.id} href={`/partidas/${partida.id}/ao-vivo`} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-red-300">Ao vivo</span>
              <p className="mt-2 text-sm font-semibold text-slate-300">{partida.liga?.nome || 'Campeonato'}</p>
              <div className="mt-4 grid grid-cols-[1fr_auto] gap-3 text-lg font-black">
                <span>{partida.equipeA?.nome || 'Equipe A'}</span>
                <span>{setAtual?.pontosA ?? partida.pontosPorA ?? 0}</span>
                <span>{partida.equipeB?.nome || 'Equipe B'}</span>
                <span>{setAtual?.pontosB ?? partida.pontosPorB ?? 0}</span>
              </div>
              <p className="mt-4 text-sm font-bold text-slate-300">
                {setAtual ? `${setAtual.numero}º set` : '1º set'}
                {' · '}
                Sets {partida.setsPorA ?? 0} x {partida.setsPorB ?? 0}
              </p>
            </Link>
          )
        })}
      </div>
      {temMais && (
        <button type="button" className="mt-6 rounded-full bg-[#ffb331] px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-60" onClick={() => void verMais()} disabled={carregandoMais}>
          {carregandoMais ? 'Carregando…' : 'Ver mais'}
        </button>
      )}
    </main>
  )
}
