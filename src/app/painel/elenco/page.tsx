'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ConsultaElenco } from '@/components/elenco/ConsultaElenco'
import { campeonatosDoElenco, escolherLigaDoElenco, type CampeonatoElenco } from '@/lib/elenco-painel'
import type { LinhaElenco } from '@/lib/grupos-fase'
import { lerSessaoPublica } from '@/lib/sessao-publica'

function ElencoDoOrganizador() {
  const busca = useSearchParams()
  const router = useRouter()
  const pedidoBruto = Number(busca.get('ligaId'))
  const pedido = Number.isInteger(pedidoBruto) && pedidoBruto > 0 ? pedidoBruto : null
  const [ligas, setLigas] = useState<CampeonatoElenco[]>([])
  const [ligasProntas, setLigasProntas] = useState(false)
  const [linhas, setLinhas] = useState<LinhaElenco[]>([])
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const visiveis = campeonatosDoElenco(ligas)
  const ligaId = ligasProntas ? escolherLigaDoElenco(ligas, pedido) : pedido

  useEffect(() => {
    const sessao = lerSessaoPublica()
    if (!sessao?.candidaturaId || sessao.tipo !== 'organizador') {
      setLigas([])
      setLigasProntas(true)
      return
    }
    const controle = new AbortController()
    fetch(`/api/ligas?organizadorId=${encodeURIComponent(sessao.candidaturaId)}`, { signal: controle.signal, cache: 'no-store' })
      .then(async (resposta) => {
        const json = await resposta.json().catch(() => ({}))
        if (!resposta.ok) throw new Error(json.error || 'Não foi possível carregar os campeonatos.')
        setLigas(Array.isArray(json.data) ? json.data : [])
      })
      .catch((falha) => {
        if (falha instanceof DOMException && falha.name === 'AbortError') return
        setErro(falha instanceof Error ? falha.message : 'Não foi possível carregar os campeonatos.')
        setLigas([])
      })
      .finally(() => setLigasProntas(true))
    return () => controle.abort()
  }, [])

  useEffect(() => {
    if (!ligasProntas || !ligaId || String(ligaId) === busca.get('ligaId')) return
    router.replace(`/painel/elenco?ligaId=${ligaId}`, { scroll: false })
  }, [ligasProntas, ligaId, busca, router])

  useEffect(() => {
    if (!ligasProntas) return
    if (!ligaId) {
      setLinhas([])
      setCarregando(false)
      return
    }
    const controle = new AbortController()
    setCarregando(true)
    fetch(`/api/organizador/elenco?ligaId=${ligaId}`, { signal: controle.signal, cache: 'no-store' })
      .then(async (resposta) => {
        const json = await resposta.json().catch(() => ({}))
        if (!resposta.ok) throw new Error(json.error || 'Não foi possível carregar o elenco.')
        setLinhas(json.data?.linhas ?? [])
        setErro('')
      })
      .catch((falha) => {
        if (falha instanceof DOMException && falha.name === 'AbortError') return
        setLinhas([])
        setErro(falha instanceof Error ? falha.message : 'Não foi possível carregar o elenco.')
      })
      .finally(() => setCarregando(false))
    return () => controle.abort()
  }, [ligaId, ligasProntas])

  return (
    <main className="luva-shell min-h-screen px-4 py-8 text-white">
      <div className="mx-auto grid max-w-3xl gap-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ffb331]">Consulta</p>
        <h1 className="font-display text-3xl font-black">Equipes e jogadores</h1>
        <p className="text-sm font-semibold text-slate-300">Somente leitura. A busca usa o nome do jogador, o número ou o nome da equipe.</p>
        <label className="block max-w-md">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">Campeonato</span>
          <select
            aria-label="Campeonato"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white"
            value={ligaId ?? ''}
            disabled={!ligasProntas || visiveis.length === 0}
            onChange={(evento) => router.replace(`/painel/elenco?ligaId=${evento.target.value}`, { scroll: false })}
          >
            {visiveis.length === 0 ? <option value="">Nenhum campeonato</option> : null}
            {visiveis.map((liga) => <option key={liga.id} value={liga.id}>{liga.nome}</option>)}
          </select>
        </label>
        {carregando ? <p className="text-sm font-semibold text-slate-300">Carregando...</p> : null}
        {erro ? <p className="text-sm font-bold text-red-200">{erro}</p> : null}
        {!carregando && !erro && !ligaId ? <p className="text-sm font-semibold text-slate-300">Você ainda não tem um campeonato para consultar o elenco.</p> : null}
        {!carregando && !erro && ligaId ? <ConsultaElenco linhas={linhas} /> : null}
      </div>
    </main>
  )
}

export default function PaginaElenco() {
  return (
    <Suspense fallback={<main className="luva-shell min-h-screen p-8 text-white">Carregando...</main>}>
      <ElencoDoOrganizador />
    </Suspense>
  )
}
