'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Image as ImageIcon, PlaySquare } from 'lucide-react'
import { ChampionshipTableSection } from '@/components/classificacao/ChampionshipTableSection'
import { PartidaCard } from '@/components/partidas/PartidaCard'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { CollapseBar } from '@/components/ui/collapse-bar'
import { formatLigaFormato, formatLigaStatus } from '@/lib/format-liga'
import type { LigaCarouselItem } from './types'

const REGRA_TABELA = 'Vitória por 2 sets a 0 vale 3 pontos. Vitória por 2 sets a 1 vale 2 pontos para o vencedor e 1 para o perdedor.'

type LigaLista = {
  id: number
  slug: string
  nome: string
  subtitulo?: string | null
  descricao?: string | null
  status?: string | null
  quantidadeEquipes?: number | null
  formato?: string | null
  inscricoesAbertas?: boolean | null
}

export function PainelCampeonatos({ organizadorId }: { organizadorId: string }) {
  const [ligas, setLigas] = useState<LigaLista[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [busca, setBusca] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch(`/api/ligas?organizadorId=${encodeURIComponent(organizadorId)}`, { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload) => {
        if (!cancelled) setLigas(Array.isArray(payload.data) ? payload.data : [])
      })
      .catch(() => {
        if (!cancelled) setLigas([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [organizadorId])

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return ligas.filter((liga) => {
      if (status && liga.status !== status) return false
      if (!termo) return true
      return [liga.nome, liga.subtitulo, liga.descricao].some((campo) => String(campo ?? '').toLowerCase().includes(termo))
    })
  }, [ligas, status, busca])

  if (loading) return <p className="px-4 py-10 text-sm font-bold text-white/50">Carregando...</p>

  return (
    <section>
      <div className="championship-filter-bar flex flex-col gap-3 rounded-[1.5rem] border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="type-kicker text-luva-amber">Filtro</p>
          <p className="type-lead mt-1">{visiveis.length === 1 ? '1 campeonato nesta lista' : `${visiveis.length} campeonatos nesta lista`}</p>
        </div>
        <form
          className="flex flex-col gap-2 sm:min-w-[280px] sm:flex-row"
          onSubmit={(event) => event.preventDefault()}
        >
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar campeonato..."
            className="championship-search-input rounded-full border px-4 py-2 text-sm font-bold"
          />
        </form>
        <div className="flex flex-wrap gap-2">
          {[
            { value: '', label: 'Todos' },
            { value: 'EM_BREVE', label: 'Em breve' },
            { value: 'ATIVA', label: 'Ativos' },
            { value: 'ENCERRADA', label: 'Encerrados' },
          ].map((option) => (
            <button
              key={option.value || 'todos'}
              type="button"
              onClick={() => setStatus(option.value)}
              className={`championship-filter-button rounded-full px-4 py-2 text-sm font-black ${status === option.value ? 'is-active' : ''}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {visiveis.length === 0 ? (
        <div className="mt-8">
          <EstadoVazio titulo="Nenhum campeonato publicado" descricao="Quando você criar campeonatos, eles aparecem nesta página." />
        </div>
      ) : (
        <div className="championship-list mt-8">
          <div className="championship-list-row championship-list-head">
            <span>Nome</span>
            <span>Status</span>
            <span>Descrição</span>
            <span>Equipes</span>
            <span>Formato</span>
            <span>Inscrições</span>
            <span>Ação</span>
          </div>
          {visiveis.map((liga) => (
            <article key={liga.id} className="championship-list-row">
              <div className="championship-list-main">
                <h2>{liga.nome}</h2>
                {liga.subtitulo && <small>{liga.subtitulo}</small>}
              </div>
              <span data-label="Status">{formatLigaStatus(liga.status)}</span>
              <span className="championship-list-description" data-label="Descrição">{liga.descricao || 'Campeonato publicado na plataforma volei.space.'}</span>
              <span data-label="Equipes">{liga.quantidadeEquipes ?? 'A definir'}</span>
              <span data-label="Formato">{formatLigaFormato(liga.formato)}</span>
              <span data-label="Inscrições">{liga.inscricoesAbertas === false ? 'Fechadas' : 'Abertas'}</span>
              <Link href={`/campeonatos/${liga.slug}`} className="championship-list-link">
                Ver campeonato
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export function PainelTabela({ ligas, organizadorId }: { ligas: LigaCarouselItem[]; organizadorId: string }) {
  const [tabelas, setTabelas] = useState<Array<{ id: number; nome: string; dados: any[] }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all(ligas.map(async (liga) => {
      const response = await fetch(`/api/classificacao?ligaId=${liga.id}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      return { id: liga.id, nome: liga.nome, dados: Array.isArray(payload.data) ? payload.data : [] }
    }))
      .then((rows) => {
        if (!cancelled) setTabelas(rows)
      })
      .catch(() => {
        if (!cancelled) setTabelas([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [ligas])

  if (loading) return <p className="px-4 py-10 text-sm font-bold text-white/50">Carregando...</p>
  if (ligas.length === 0) {
    return (
      <section>
        <EstadoVazio titulo="Nenhum campeonato para classificar." descricao="Crie um campeonato em Início. A tabela fica nesta página quando houver resultados." />
      </section>
    )
  }

  return (
    <section className="space-y-8">
      {tabelas.map((tabela) => (
        <div key={tabela.id}>
          {tabela.dados.length === 0 ? (
            <CollapseBar title={tabela.nome}>
              <EstadoVazio titulo="Nenhuma partida registrada" descricao="A classificação aparece aqui após o primeiro resultado aprovado." />
            </CollapseBar>
          ) : (
            <ChampionshipTableSection
              nome={tabela.nome}
              regra={REGRA_TABELA}
              dados={tabela.dados}
              ligaId={tabela.id}
              organizadorId={organizadorId}
              organizerMode
            />
          )}
        </div>
      ))}
    </section>
  )
}

export function PainelJogos({ ligas }: { ligas: LigaCarouselItem[] }) {
  const [blocos, setBlocos] = useState<Array<{ id: number; nome: string; partidas: any[] }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all(ligas.map(async (liga) => {
      const response = await fetch(`/api/partidas?ligaId=${liga.id}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      const partidas = Array.isArray(payload.data) ? payload.data : []
      return { id: liga.id, nome: liga.nome, partidas }
    }))
      .then((rows) => {
        if (!cancelled) setBlocos(rows)
      })
      .catch(() => {
        if (!cancelled) setBlocos([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [ligas])

  if (loading) return <p className="px-4 py-10 text-sm font-bold text-white/50">Carregando...</p>
  if (ligas.length === 0) {
    return (
      <section>
        <EstadoVazio titulo="Nenhum campeonato com agenda." descricao="Crie um campeonato em Início. Os jogos ficam nesta página quando o calendário for montado." />
      </section>
    )
  }

  return (
    <section className="space-y-6">
      {blocos.map((bloco) => {
        const rodadas = new Map<number, any[]>()
        bloco.partidas.forEach((partida) => {
          const rodada = Number(partida.rodada) || 0
          const lista = rodadas.get(rodada) ?? []
          lista.push(partida)
          rodadas.set(rodada, lista)
        })
        return (
          <CollapseBar key={bloco.id} title={bloco.nome}>
            {bloco.partidas.length === 0 ? (
              <EstadoVazio titulo="Nenhum jogo cadastrado" descricao="As partidas aparecem aqui quando a organização montar o calendário." />
            ) : (
              <div className="grid gap-3">
                {Array.from(rodadas.entries()).sort((a, b) => a[0] - b[0]).map(([rodada, partidas]) => (
                  <CollapseBar key={rodada} title={rodada ? `Rodada ${rodada}` : 'Jogos'}>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {partidas.map((partida) => <PartidaCard key={partida.id} partida={partida} />)}
                    </div>
                  </CollapseBar>
                ))}
              </div>
            )}
          </CollapseBar>
        )
      })}
    </section>
  )
}

export function PainelGaleria({ ligas }: { ligas: LigaCarouselItem[] }) {
  const [blocos, setBlocos] = useState<Array<{ id: number; nome: string; midias: any[] }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all(ligas.map(async (liga) => {
      const response = await fetch(`/api/galeria?ligaId=${liga.id}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      return { id: liga.id, nome: liga.nome, midias: Array.isArray(payload.data) ? payload.data : [] }
    }))
      .then((rows) => {
        if (!cancelled) setBlocos(rows)
      })
      .catch(() => {
        if (!cancelled) setBlocos([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [ligas])

  if (loading) return <p className="px-4 py-10 text-sm font-bold text-white/50">Carregando...</p>
  if (ligas.length === 0) {
    return (
      <section>
        <EstadoVazio titulo="Nenhuma galeria disponível." descricao="Crie um campeonato em Início. Fotos e vídeos ficam nesta página quando forem publicados." />
      </section>
    )
  }

  return (
    <section className="space-y-10">
      {blocos.map((bloco) => {
        const fotos = bloco.midias.filter((midia) => midia.tipo === 'FOTO')
        const videos = bloco.midias.filter((midia) => midia.tipo === 'VIDEO')
        return (
          <div key={bloco.id}>
            <h2 className="font-display text-3xl font-black text-white">{bloco.nome}</h2>
            {bloco.midias.length === 0 ? (
              <div className="mt-4">
                <EstadoVazio titulo="Nenhuma mídia disponível ainda" descricao="As fotos e vídeos aparecem aqui quando forem publicados." />
              </div>
            ) : (
              <div className="mt-5 grid gap-8">
                {fotos.length > 0 && (
                  <div>
                    <div className="mb-4 flex items-center gap-2">
                      <ImageIcon size={20} className="text-luva-amber" />
                      <h3 className="font-display text-2xl font-black text-white">Fotos</h3>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {fotos.map((foto, index) => (
                        <figure key={foto.id} className={`gallery-card overflow-hidden rounded-2xl border ${index === 0 ? 'sm:col-span-2 sm:row-span-2' : ''}`}>
                          <div className={`${index === 0 ? 'aspect-[16/10]' : 'aspect-square'} bg-slate-950/60`}>
                            <img src={foto.url} alt={foto.titulo ?? 'Foto da liga'} className="h-full w-full object-cover" />
                          </div>
                          <figcaption className="p-4">
                            <p className="font-black text-white">{foto.titulo ?? 'Registro da temporada'}</p>
                            {foto.tag && <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-slate-200">{foto.tag}</p>}
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  </div>
                )}
                {videos.length > 0 && (
                  <div>
                    <div className="mb-4 flex items-center gap-2">
                      <PlaySquare size={20} className="text-luva-amber" />
                      <h3 className="font-display text-2xl font-black text-white">Vídeos</h3>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {videos.map((video) => (
                        <div key={video.id} className="gallery-card overflow-hidden rounded-2xl border">
                          <div className="aspect-video bg-slate-950/60">
                            <iframe src={video.url} className="h-full w-full" allowFullScreen title={video.titulo ?? 'Vídeo da liga'} />
                          </div>
                          <div className="p-4">
                            <p className="font-black text-white">{video.titulo ?? 'Vídeo da temporada'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}
