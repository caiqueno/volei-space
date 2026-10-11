'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { capaDoCampeonato } from '@/lib/capa-publica'

type Campeonato = {
  id: number
  nome: string
  subtitulo: string | null
  capaUrl: string | null
  logoUrl: string | null
}

type EscolhaCampeonatoProps = {
  basePath?: string
  kicker?: string
  descricao?: string
  filtro?: string
}

export function EscolhaCampeonato({
  basePath = '/portal',
  kicker = 'Portal',
  descricao = 'Toque em um campeonato para abrir a agenda, a tabela e as fotos dele.',
  filtro,
}: EscolhaCampeonatoProps = {}) {
  const [campeonatos, setCampeonatos] = useState<Campeonato[]>([])
  const [busca, setBusca] = useState('')
  const [consulta, setConsulta] = useState('')
  const [temMais, setTemMais] = useState(false)
  const [proximoOffset, setProximoOffset] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setConsulta(busca.trim()), 350)
    return () => window.clearTimeout(timer)
  }, [busca])

  useEffect(() => {
    const controle = new AbortController()
    setCarregando(true)
    const parametro = consulta.length >= 2 ? `&q=${encodeURIComponent(consulta)}` : ''
    fetch(`/api/portal/campeonatos?limite=12${parametro}`, { signal: controle.signal })
      .then(async (resposta) => {
        const json = await resposta.json()
        if (!resposta.ok) throw new Error(json.error || 'Falha ao carregar')
        setCampeonatos(json.data?.campeonatos ?? [])
        setTemMais(Boolean(json.data?.temMais))
        setProximoOffset(Number(json.data?.proximoOffset ?? 0))
        setErro('')
      })
      .catch((causa) => {
        if (causa instanceof DOMException && causa.name === 'AbortError') return
        setErro('Não foi possível carregar os campeonatos.')
      })
      .finally(() => {
        if (!controle.signal.aborted) setCarregando(false)
      })
    return () => controle.abort()
  }, [consulta])

  async function verMais() {
    const parametro = consulta.length >= 2 ? `&q=${encodeURIComponent(consulta)}` : ''
    const resposta = await fetch(`/api/portal/campeonatos?limite=12&offset=${proximoOffset}${parametro}`)
    const json = await resposta.json()
    if (!resposta.ok) return
    const novos = (json.data?.campeonatos ?? []) as Campeonato[]
    setCampeonatos((atual) => {
      const ids = new Set(atual.map((item) => item.id))
      return [...atual, ...novos.filter((item) => !ids.has(item.id))]
    })
    setTemMais(Boolean(json.data?.temMais))
    setProximoOffset(Number(json.data?.proximoOffset ?? proximoOffset))
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#ffb331]">{kicker}</p>
      <h1 className="mt-2 font-display text-4xl font-black text-white">Escolha seu campeonato</h1>
      <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">{descricao}</p>
      <label className="mt-6 block max-w-md">
        <span className="sr-only">Pesquisar campeonato</span>
        <input
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          placeholder="Pesquisar campeonato"
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-400"
        />
      </label>
      {erro && <p className="mt-6 text-sm font-bold text-red-200">{erro}</p>}
      {carregando && campeonatos.length === 0 && <p className="mt-8 text-sm font-semibold text-slate-300">Carregando campeonatos…</p>}
      {!carregando && campeonatos.length === 0 && <p className="mt-8 text-sm font-semibold text-slate-300">Nenhum campeonato encontrado.</p>}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {campeonatos.map((campeonato) => (
          <Link key={campeonato.id} href={hrefDoCampeonato(basePath, campeonato.id, filtro)} className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
            <div className="aspect-video bg-slate-950">
              <img src={capaDoCampeonato(campeonato.id, campeonato.capaUrl, campeonato.logoUrl)} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
            </div>
            <div className="p-4">
              <p className="font-black text-white">{campeonato.nome}</p>
              {campeonato.subtitulo && <p className="mt-1 text-sm font-semibold text-slate-300">{campeonato.subtitulo}</p>}
            </div>
          </Link>
        ))}
      </div>
      {temMais && (
        <button type="button" className="mt-6 rounded-full bg-[#ffb331] px-5 py-3 text-sm font-black text-slate-950" onClick={() => void verMais()}>
          Ver mais
        </button>
      )}
    </section>
  )
}

function hrefDoCampeonato(basePath: string, id: number, filtro?: string) {
  const params = new URLSearchParams()
  params.set('ligaId', String(id))
  if (filtro && filtro !== 'todos') params.set('filtro', filtro)
  return `${basePath}?${params.toString()}`
}
