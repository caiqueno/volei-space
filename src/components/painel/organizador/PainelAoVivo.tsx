'use client'

import { useEffect, useState } from 'react'
import LiveMatchView from '@/app/partidas/[id]/ao-vivo/LiveMatchView'
import { consultar, ConsultaCancelada } from '@/lib/api-cliente'
import { SeletorCategoria, queryCategoria, useCategoriaDoCampeonato } from '@/components/portal/SeletorCategoria'
import type { LigaCarouselItem } from './types'

type JogoAoVivo = {
  id: number
  rodada?: number | null
  dataHora?: string | null
  setsPorA?: number | null
  setsPorB?: number | null
  pontosPorA?: number | null
  pontosPorB?: number | null
  equipeA?: { nome?: string | null } | null
  equipeB?: { nome?: string | null } | null
}

export function PainelAoVivo({ ligas, campeonatoId, onSelect }: { ligas: LigaCarouselItem[]; campeonatoId: number | null; onSelect: (id: number) => void }) {
  const [jogos, setJogos] = useState<JogoAoVivo[]>([])
  const [partidaId, setPartidaId] = useState<number | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const liga = ligas.find((item) => item.id === campeonatoId) ?? ligas[0] ?? null
  const { categorias, categoriaId, setCategoriaId, pronto } = useCategoriaDoCampeonato(liga?.id ?? null)

  useEffect(() => {
    if (!liga || !pronto) {
      if (!liga) {
        setJogos([])
        setPartidaId(null)
        setCarregando(false)
      }
      return
    }
    let cancelado = false
    setCarregando(true)
    consultar<{ data?: { partidas?: JogoAoVivo[] } }>(`/api/organizador/partidas?ligaId=${liga.id}&status=EM_ANDAMENTO&limite=30${queryCategoria(categoriaId)}`, { forcar: true })
      .then((json) => {
        if (cancelado) return
        const lista = Array.isArray(json.data?.partidas) ? json.data.partidas : []
        const pedido = Number(new URLSearchParams(window.location.search).get('partida'))
        const escolhido = lista.some((jogo) => jogo.id === pedido) ? pedido : lista[0]?.id ?? null
        setJogos(lista)
        setPartidaId(escolhido)
        setErro(null)
        gravarPartida(escolhido)
      })
      .catch((falha) => {
        if (falha instanceof ConsultaCancelada || cancelado) return
        setErro('Não foi possível carregar os jogos ao vivo.')
      })
      .finally(() => {
        if (!cancelado) setCarregando(false)
      })
    return () => {
      cancelado = true
    }
  }, [liga?.id, categoriaId, pronto])

  function gravarPartida(id: number | null) {
    const params = new URLSearchParams(window.location.search)
    params.set('secao', 'aovivo')
    if (liga) params.set('ligaId', String(liga.id))
    if (id) params.set('partida', String(id))
    else params.delete('partida')
    window.history.replaceState(null, '', `/painel?${params.toString()}`)
  }

  function escolherJogo(id: number) {
    setPartidaId(id)
    gravarPartida(id)
  }

  if (!liga) {
    return <p className="text-sm font-bold text-white/70">Crie um campeonato para acompanhar os jogos ao vivo.</p>
  }

  return (
    <section className="space-y-5">
      <label className="block max-w-md">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">Campeonato</span>
        <select className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white" value={liga.id} onChange={(evento) => onSelect(Number(evento.target.value))}>
          {ligas.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
        </select>
      </label>
      <SeletorCategoria categorias={categorias} valor={categoriaId} onChange={setCategoriaId} />
      {erro && <p className="rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">{erro}</p>}
      {carregando || !pronto ? <p className="text-sm font-bold text-white/50">Carregando jogos ao vivo...</p> : (
        <div className="operator-live-board">
          <div className="operator-live-list" role="list">
            {jogos.length === 0 ? <p>{categoriaId ? 'Nenhum jogo ao vivo nesta categoria.' : 'Nenhum jogo ao vivo neste campeonato.'}</p> : jogos.map((jogo) => (
              <button key={jogo.id} type="button" role="listitem" className={partidaId === jogo.id ? 'is-active' : ''} onClick={() => escolherJogo(jogo.id)}>
                <strong>{jogo.equipeA?.nome ?? 'Equipe A'} × {jogo.equipeB?.nome ?? 'Equipe B'}</strong>
                <span>Rodada {jogo.rodada || '—'} · {jogo.setsPorA ?? 0} × {jogo.setsPorB ?? 0} sets · {jogo.pontosPorA ?? 0} a {jogo.pontosPorB ?? 0}</span>
              </button>
            ))}
          </div>
          <aside className="operator-live-dock is-inline" aria-label="Acompanhamento ao vivo">
            {partidaId ? <LiveMatchView key={partidaId} partidaId={String(partidaId)} embutido /> : <p className="operator-live-dock-empty">Escolha um jogo ao vivo para abrir o acompanhamento nesta tela.</p>}
          </aside>
        </div>
      )}
    </section>
  )
}
